import logger from "../lib/logger.ts";
import { notificationQueue } from "./queues.ts";

export function enqueuePushNotifications(
  pushTokens: Array<{ token: string }>,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  pushTokens.forEach(({ token }) => {
    notificationQueue
      .add("notification", { token, title, body, data })
      .catch((error: unknown) => {
        logger.warn({ error, token }, "Failed to enqueue notification");
      });
  });
}
