import logger from "../lib/logger.ts";
import { notificationQueue } from "./queues.ts";

export type PushNotificationType =
  | "comment_created"
  | "comment_reply"
  | "post_liked"
  | "comment_liked"
  | "user_followed";

export interface PushNotificationPayload {
  type: PushNotificationType;
  redirectPath: string;
  postId?: string;
  commentId?: string;
  parentCommentId?: string;
  actorId?: string;
  actorName?: string;
  followerId?: string;
}

export function enqueuePushNotifications(
  pushTokens: string[],
  title: string,
  body: string,
  data?: PushNotificationPayload,
) {
  pushTokens.forEach((token) => {
    notificationQueue
      .add("notification", { token, title, body, data })
      .catch((error: unknown) => {
        logger.warn({ error, token }, "Failed to enqueue notification");
      });
  });
}
