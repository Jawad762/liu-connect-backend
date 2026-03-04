import { Queue } from "bullmq";
import { redis } from "./connection.ts";

export const EMAIL_QUEUE_NAME = "email-queue";
export const NOTIFICATION_QUEUE_NAME = "notification-queue";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, { connection: redis });
export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
  connection: redis,
});
