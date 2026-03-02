import { messaging } from "../lib/firebase.ts";
import logger from "../lib/logger.ts";

export const sendNotification = async (token: string, title: string, body: string) => {
  try {
    const message = {
      token,
      notification: { title, body },
    };
    await messaging.send(message);
  } catch (error) {
    logger.error({ err: error }, "Failed to send push notification");
  }
}