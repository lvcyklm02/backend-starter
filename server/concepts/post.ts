import { Filter, ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface PostOptions {
  backgroundColor?: string;
}

export interface PostDoc extends BaseDoc {
  author: ObjectId;
  content: string;
  comments: Array<ObjectId>;
  techniques: Array<ObjectId>;
  options?: PostOptions;
}

export default class PostConcept {
  public readonly posts = new DocCollection<PostDoc>("posts");

  async create(author: ObjectId, content: string, options?: PostOptions) {
    const comments: Array<ObjectId> = [];
    const techniques: Array<ObjectId> = [];
    const _id = await this.posts.createOne({ author, content, comments, techniques, options });
    return { msg: "Post successfully created!", post: await this.posts.readOne({ _id }) };
  }

  async getPosts(query: Filter<PostDoc>) {
    const posts = await this.posts.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return posts;
  }

  async getPostById(_id: ObjectId) {
    const post = await this.posts.readOne({ _id });
    if (post === null) {
      throw new NotFoundError(`Post not found!`);
    }
    return post;
  }

  async idsToRootAuthorIds(ids: ObjectId[]) {
    const posts = await this.posts.readMany({ _id: { $in: ids } });

    return posts.map((post) => post.author);
  }

  async getByAuthor(author: ObjectId) {
    return await this.getPosts({ author });
  }

  async update(_id: ObjectId, update: Partial<PostDoc>) {
    this.sanitizeUpdate(update);
    await this.posts.updateOne({ _id }, update);
    return { msg: "Post successfully updated!" };
  }

  async getCommentIds(_id: ObjectId) {
    const post = await this.getPostById(_id);
    console.log("received comments", post.comments);
    return post.comments;
  }

  async addCommentId(_id: ObjectId, comment_id: ObjectId) {
    const comments = await this.getCommentIds(_id);
    const comments_copy = [...comments];
    comments_copy.push(comment_id);

    await this.update(_id, { comments: comments_copy });
    return { msg: "Comment added to post!" };
  }

  async getTechniqueIds(_id: ObjectId) {
    const post = await this.getPostById(_id);
    console.log("received tags", post.techniques);
    return post.techniques;
  }

  async addTechniqueId(_id: ObjectId, technique_id: ObjectId) {
    const techniques = await this.getTechniqueIds(_id);
    const techniques_copy = [...techniques];
    techniques_copy.push(technique_id);

    await this.update(_id, { techniques: techniques_copy });
    return { msg: "Technique added to post!" };
  }

  async delete(_id: ObjectId) {
    await this.posts.deleteOne({ _id });
    return { msg: "Post deleted successfully!" };
  }

  async isAuthor(user: ObjectId, _id: ObjectId) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    if (post.author.toString() !== user.toString()) {
      throw new PostAuthorNotMatchError(user, _id);
    }
  }

  private sanitizeUpdate(update: Partial<PostDoc>) {
    // Make sure the update cannot change the author.
    const allowedUpdates = ["content", "options", "comments", "techniques"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}

export class PostAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of post {1}!", author, _id);
  }
}
