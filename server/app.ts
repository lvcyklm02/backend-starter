import CommentConcept from "./concepts/comment";
import EventConcept from "./concepts/event";
import FriendConcept from "./concepts/friend";
import PostConcept from "./concepts/post";
import TagConcept from "./concepts/tag";
import UserConcept from "./concepts/user";
import WebSessionConcept from "./concepts/websession";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const User = new UserConcept();
export const Post = new PostConcept();
export const Friend = new FriendConcept();
export const Technique = new TagConcept<string>(false);
export const Comment = new CommentConcept();
export const Event = new EventConcept();
