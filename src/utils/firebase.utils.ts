import { messaging } from "../lib/firebase.ts";
import logger from "../lib/logger.ts";

export const sendNotification = async (
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) => {
  try {
    const message: {
      token: string;
      notification: { title: string; body: string };
      data?: Record<string, string>;
    } = {
      token,
      notification: { title, body },
    };

    if (data) {
      message.data = data;
    }

    await messaging.send(message);
  } catch (error) {
    logger.error({ err: error }, "Failed to send push notification");
  }
};