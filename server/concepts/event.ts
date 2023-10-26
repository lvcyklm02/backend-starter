import { Filter, ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface EventOptions {
  teacher?: string | ObjectId;
}

export interface EventDoc extends BaseDoc {
  organizer: ObjectId;
  content: string;
  capacity: number;
  roster: Array<ObjectId>;
  start: Date;
  end: Date;
  status: "complete" | "active" | "cancelled";
  options?: EventOptions;
}

export default class EventConcept {
  public readonly events = new DocCollection<EventDoc>("events");

  async create(organizer: ObjectId, content: string, capacity: number, start: Date, end: Date, options?: EventOptions) {
    const roster: Array<ObjectId> = [];
    const status = "active";
    const _id = await this.events.createOne({ organizer, content, capacity, roster, start, end, status, options });
    return { msg: "Event successfully created!", event: await this.events.readOne({ _id }) };
  }

  async getEvents(query: Filter<EventDoc>) {
    const events = await this.events.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return events;
  }

  async getActiveEvents(query: Filter<EventDoc>) {
    const events = await this.getEvents(query);
    return events.filter((event) => event.status === "active");
  }

  async getEventById(_id: ObjectId) {
    const event = await this.events.readOne({ _id });
    if (event === null) {
      throw new NotFoundError(`Event not found!`);
    }
    return event;
  }

  async idsToRootOrganizerIds(ids: ObjectId[]) {
    const events = await this.events.readMany({ _id: { $in: ids } });

    return events.map((event) => event.organizer);
  }

  async getByOrganizer(organizer: ObjectId) {
    return await this.getEvents({ organizer });
  }

  async getActiveByUser(organizer: ObjectId) {
    const events = await this.getEvents({});
    const eventRosters = new Map(events.map((event) => [event.roster, event._id]));
    const usersEvents: Array<ObjectId> = [];

    eventRosters.forEach((event_id, roster) => {
      if (organizer.toString() in roster.map((user_id) => user_id.toString())) {
        usersEvents.push(event_id);
      }
    });

    return this.filterByActive(usersEvents);
  }

  async getActiveByOrganizer(organizer: ObjectId) {
    const events = await this.getByOrganizer(organizer);
    return events.filter((event) => event.status === "active");
  }

  async filterByActive(ids: Array<ObjectId>) {
    const eventPromises = ids.map((id) => this.getEventById(id));
    const events: EventDoc[] = await Promise.all(eventPromises);
    return events.filter((event) => event.status === "active");
  }

  async updateEvent(_id: ObjectId, update: Partial<EventDoc>) {
    this.sanitizeUpdate(update);
    await this.events.updateOne({ _id }, update);
    return { msg: "Event successfully updated!" };
  }

  async getRosterUserIds(_id: ObjectId) {
    const event = await this.getEventById(_id);
    return event.roster;
  }

  async isNotFull(_id: ObjectId) {
    const event = await this.getEventById(_id);
    if (event.roster.length >= event.capacity) {
      throw new AlreadyFullError(_id);
    }
  }

  async isNotRegistered(_id: ObjectId, user_id: ObjectId) {
    const event = await this.getEventById(_id);
    if (user_id.toString() in event.roster) {
      throw new AlreadyRegisteredError(user_id, _id);
    }
  }

  async isRegistered(_id: ObjectId, user_id: ObjectId) {
    const event = await this.getEventById(_id);
    if (!(user_id.toString() in event.roster)) {
      throw new NotRegisteredError(user_id, _id);
    }
  }

  async addRosterUserId(_id: ObjectId, user_id: ObjectId) {
    // Only add user if not at capacity and user not in event
    await this.isNotFull(_id);
    await this.isNotRegistered(_id, user_id);
    await this.isNotOrganizer(user_id, _id);

    const users = await this.getRosterUserIds(_id);
    const users_copy = [...users];
    users_copy.push(user_id);

    await this.updateEvent(_id, { roster: users_copy });
    return { msg: "User added to roster!" };
  }

  async deleteRosterUserId(_id: ObjectId, user_id: ObjectId) {
    await this.isRegistered(_id, user_id);

    const users = await this.getRosterUserIds(_id);
    const users_copy = [];
    for (const user of users) {
      if (user.toString() !== user_id.toString()) {
        users_copy.push(user);
      }
    }
    await this.updateEvent(_id, { roster: users_copy });
    return { msg: "User deleted from roster!" };
  }

  async delete(_id: ObjectId) {
    await this.events.deleteOne({ _id });
    return { msg: "Event deleted successfully!" };
  }

  async isOrganizer(user: ObjectId, _id: ObjectId) {
    const event = await this.events.readOne({ _id });
    if (!event) {
      throw new NotFoundError(`Event ${_id} does not exist!`);
    }
    if (event.organizer.toString() !== user.toString()) {
      throw new EventOrganizerNotMatchError(user, _id);
    }
  }

  async isNotOrganizer(user: ObjectId, _id: ObjectId) {
    const event = await this.events.readOne({ _id });
    if (!event) {
      throw new NotFoundError(`Event ${_id} does not exist!`);
    }
    if (event.organizer.toString() === user.toString()) {
      throw new OrganizerCannotRegister(_id);
    }
  }

  async updateStatus(_id: ObjectId, status: "complete" | "active" | "cancelled") {
    await this.events.updateOne({ _id }, { status });
    return { msg: "Event status successfully updated!" };
  }

  async cancelEvent(_id: ObjectId) {
    const status = "cancelled";
    await this.events.updateOne({ _id }, { status });
    return { msg: "Event successfully cancelled!" };
  }

  async updateStatusAutomated() {
    // complete all events that have passed and were active

    const events = await this.getEvents({});
    // Store strings in Map because ObjectId comparison by reference is wrong
    const eventIdToEvent = new Map(events.map((event) => [event._id, event]));
    const now: Date = new Date();

    eventIdToEvent.forEach(async (event, event_id) => {
      if (event.status == "active" && event.end < now) {
        await this.updateStatus(event_id, "complete");
      }
    });
    return { msg: "Updated completion of all events." };
  }

  private sanitizeUpdate(update: Partial<EventDoc>) {
    // Make sure the update cannot change the author.
    const allowedUpdates = ["content", "roster", "options", "capacity", "start", "end", "status"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}

export class EventOrganizerNotMatchError extends NotAllowedError {
  constructor(
    public readonly organizer: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the organizer of event {1}!", organizer, _id);
  }
}

export class AlreadyRegisteredError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is already registered for {1}!", user, _id);
  }
}

export class NotRegisteredError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not registered for {1}!", user, _id);
  }
}

export class AlreadyFullError extends NotAllowedError {
  constructor(public readonly _id: ObjectId) {
    super("Event {0} is already full!", _id);
  }
}

export class OrganizerCannotRegister extends NotAllowedError {
  constructor(public readonly _id: ObjectId) {
    super("Cannot register for your own Event {0}", _id);
  }
}
