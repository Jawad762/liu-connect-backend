import { Message } from "firebase-admin/messaging";
import { messaging } from "../lib/firebase.ts";
import logger from "../lib/logger.ts";

export const sendNotification = async (
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) => {
  try {
    const message: Message = {
      token,
      notification: { title, body },
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: { sound: "default", badge: 1 },
        },
      },
    };

    if (data) {
      message.data = data;
    }

    await messaging.send(message);
  } catch (error) {
    logger.error({ err: error }, "Failed to send push notification");
  }
};