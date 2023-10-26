import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Comment, Event, Friend, Post, Technique, User, WebSession } from "./app";
import { CommentDoc } from "./concepts/comment";
import { EventDoc } from "./concepts/event";
import { PostDoc, PostOptions } from "./concepts/post";
import { UserDoc } from "./concepts/user";
import { WebSessionDoc } from "./concepts/websession";
import Responses from "./responses";

class Routes {
  @Router.get("/session")
  async getSessionUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await User.getUsers();
  }

  @Router.get("/users/:username")
  async getUser(username: string) {
    return await User.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: WebSessionDoc, username: string, password: string) {
    WebSession.isLoggedOut(session);
    return await User.create(username, password);
  }

  @Router.patch("/users")
  async updateUser(session: WebSessionDoc, update: Partial<UserDoc>) {
    const user = WebSession.getUser(session);
    return await User.update(user, update);
  }

  @Router.delete("/users")
  async deleteUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    WebSession.end(session);
    return await User.delete(user);
  }

  @Router.post("/login")
  async logIn(session: WebSessionDoc, username: string, password: string) {
    const u = await User.authenticate(username, password);
    WebSession.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: WebSessionDoc) {
    WebSession.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      posts = await Post.getByAuthor(id);
    } else {
      posts = await Post.getPosts({});
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: WebSessionDoc, content: string, options?: PostOptions) {
    const user = WebSession.getUser(session);
    const created = await Post.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:_id")
  async updatePost(session: WebSessionDoc, _id: ObjectId, update: Partial<PostDoc>) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return await Post.update(_id, update);
  }

  @Router.delete("/posts/:_id")
  async deletePost(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return Post.delete(_id);
  }

  @Router.get("/friends")
  async getFriends(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.idsToUsernames(await Friend.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: WebSessionDoc, friend: string) {
    const user = WebSession.getUser(session);
    const friendId = (await User.getUserByUsername(friend))._id;
    return await Friend.removeFriend(user, friendId);
  }

  @Router.get("/friend/requests")
  async getRequests(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.friendRequests(await Friend.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.sendRequest(user, toId);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.removeRequest(user, toId);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.acceptRequest(fromId, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.rejectRequest(fromId, user);
  }

  // COMMENT CONCEPT

  @Router.get("/comments")
  async getComments(author?: string) {
    /**
     * converts postId to poster's username and authorId to username for readability
     */
    let comments;
    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      comments = await Comment.getByAuthor(id);
    } else {
      comments = await Comment.getComments({});
    }
    return Responses.comments(comments);
  }

  @Router.post("/comments")
  async createComment(session: WebSessionDoc, content: string, root: ObjectId) {
    const rootType: string = "Post";
    const user = WebSession.getUser(session);
    const created = await Comment.create(user, content, root);

    if (!created.comment) {
      throw Error("No comment created");
    }
    const comment_id = created.comment._id;

    // also add to the options of the related post
    if (rootType === "Post") {
      await Post.addCommentId(root, comment_id);
    }

    return { msg: created.msg, Comment: await Responses.comment(created.comment) };
  }

  @Router.patch("/comments/:_id")
  async updateComment(session: WebSessionDoc, _id: ObjectId, update: Partial<CommentDoc>) {
    const user = WebSession.getUser(session);
    await Comment.isAuthor(user, _id);
    return await Comment.update(_id, update);
  }

  @Router.delete("/comments/:_id")
  async deleteComment(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Comment.isAuthor(user, _id);
    return Comment.delete(_id);
  }

  // TAG CONCEPT

  @Router.get("/techniques")
  async getTechniques(author?: string, root?: ObjectId, content?: string) {
    let tags;
    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      tags = await Technique.getByAuthor(id);
    } else if (content) {
      tags = await Technique.getTags({ content });
    } else if (root) {
      tags = await Technique.getByRoot(root);
    } else {
      tags = await Technique.getTags({});
    }
    return tags;
  }

  @Router.post("/techniques")
  async createTechniques(session: WebSessionDoc, content: string, root: ObjectId) {
    const user = WebSession.getUser(session);
    const created = await Technique.create(user, content, root);

    if (!created.tag) {
      throw Error("No tag created");
    }
    const tag_id = created.tag._id;

    await Post.addTechniqueId(root, tag_id);
    return { msg: created.msg, tag: created.tag };
  }

  // EVENT CONCEPT
  @Router.get("/events")
  async getEvents(organizer?: string) {
    let events;
    if (organizer) {
      const id = (await User.getUserByUsername(organizer))._id;
      events = await Event.getByOrganizer(id);
    } else {
      events = await Event.getEvents({});
    }

    return events;
  }

  @Router.get("/events/active")
  async getActiveEvents(organizer?: string, user?: string) {
    let events;
    if (organizer) {
      const id = (await User.getUserByUsername(organizer))._id;
      events = await Event.getActiveByOrganizer(id);
    } else if (user) {
      const id = (await User.getUserByUsername(user))._id;
      events = await Event.getActiveByUser(id);
    } else {
      events = await Event.getActiveEvents({});
    }
    return events;
  }

  @Router.post("/events")
  async createEvent(session: WebSessionDoc, content: string, capacity: number, month: number, day: number, startHour: number, startMinute: number, endHour: number, endMinute: number) {
    const organizer = WebSession.getUser(session);
    const year = new Date().getFullYear();
    const monthIndex = month - 1;

    const start = new Date(year, monthIndex, day, startHour, startMinute);
    const end = new Date(year, monthIndex, day, endHour, endMinute);
    const event = await Event.create(organizer, content, capacity, start, end);
    return event;
  }

  @Router.delete("/events/:_id")
  async deleteEvent(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Event.isOrganizer(user, _id);
    return Event.delete(_id);
  }

  @Router.patch("/events/register/:_id")
  async registerForEvent(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    return await Event.addRosterUserId(_id, user);
  }

  @Router.patch("/events/unregister/:_id")
  async unregisterForEvent(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    return await Event.deleteRosterUserId(_id, user);
  }

  @Router.patch("/events/cancel/:_id")
  async cancelEvent(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Event.isOrganizer(user, _id);
    return Event.cancelEvent(_id);
  }

  @Router.patch("/events/:_id")
  async updateEvent(session: WebSessionDoc, _id: ObjectId, update: Partial<EventDoc>) {
    const user = WebSession.getUser(session);
    await Event.isOrganizer(user, _id);
    return Event.updateEvent(_id, update);
  }
}

export default getExpressRouter(new Routes());
