import "dotenv/config";
import { Worker } from "bullmq";
import logger from "./lib/logger.ts";
import { redis } from "./queue/connection.ts";
import {
  EMAIL_QUEUE_NAME,
  NOTIFICATION_QUEUE_NAME,
} from "./queue/queues.ts";
import {
  processEmailJob,
  processNotificationJob,
} from "./queue/processors.ts";

const workerOptions = {
  connection: redis,
  concurrency: 5,
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
};

const emailWorker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, workerOptions);
const notificationWorker = new Worker(NOTIFICATION_QUEUE_NAME, processNotificationJob, workerOptions);

emailWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, jobName: job?.name, err },
    "Email job failed",
  );
});

notificationWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, jobName: job?.name, err },
    "Notification job failed",
  );
});

logger.info("Workers started");

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Worker shutting down gracefully");
  try {
    await emailWorker.close();
    await notificationWorker.close();
    await redis.quit();
    logger.info("Worker and Redis connection closed");
  } catch (err) {
    logger.error({ err }, "Error during worker shutdown");
  }
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
