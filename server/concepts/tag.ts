import { Filter, ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError } from "./errors";

export interface TagDoc extends BaseDoc {
  author: ObjectId; // used to check exclusive tag rights
  content: string;
  root: ObjectId;
  exclusive: Boolean; //only one per post, must be assigned by author
}

export default class TagConcept {
  public readonly tags = new DocCollection<TagDoc>("tag");

  async create(author: ObjectId, content: string, root: ObjectId) {
    const _id = await this.tags.createOne({ author, content, root });
    return { msg: "Comment successfully created!", tag: await this.tags.readOne({ _id }) };
  }

  async getTags(query: Filter<TagDoc>) {
    const comment = await this.tags.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return comment;
  }

  async getByAuthor(author: ObjectId) {
    return await this.getTags({ author: author });
  }

  async getByRoot(root: ObjectId) {
    return await this.getTags({ root: root });
  }

  private sanitizeUpdate(update: Partial<TagDoc>) {
    // Make sure the update cannot change the author.
    const allowedUpdates = ["content"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}
