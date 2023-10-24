import { Filter, ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError } from "./errors";

export interface TagDoc<T> extends BaseDoc {
  author: ObjectId; // used to check exclusive tag rights
  content: T;
  root: ObjectId;
}

export default class TagConcept<T> {
  public readonly tags = new DocCollection<TagDoc<T>>("tag");
  private exclusive: Boolean;

  constructor(exclusive: Boolean) {
    this.exclusive = exclusive;
  }

  async create(author: ObjectId, content: T, root: ObjectId) {
    const exclusive = this.exclusive;
    const already_exist = await this.getByAuthor(author);

    const _id = await this.tags.createOne({ author, content, root });
    let msg: string = "";

    if (exclusive && already_exist) {
      await this.delete(already_exist[0]._id);
      msg = "Tag existed and now overwritten!";
    } else {
      msg = "Tag successfully created!";
    }
    return { msg: msg, tag: await this.tags.readOne({ _id }) };
  }

  async getTags(query: Filter<TagDoc<T>>) {
    const tag = await this.tags.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return tag;
  }

  async getByAuthor(author: ObjectId) {
    return await this.getTags({ author: author });
  }

  async getByRoot(root: ObjectId) {
    return await this.getTags({ root: root });
  }

  async delete(_id: ObjectId) {
    await this.tags.deleteOne({ _id });
    return { msg: "Tag deleted successfully!" };
  }
  private sanitizeUpdate(update: Partial<TagDoc<T>>) {
    // Make sure the update cannot change the author.
    const allowedUpdates = ["content"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}
