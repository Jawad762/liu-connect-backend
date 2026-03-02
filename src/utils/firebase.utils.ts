import { messaging } from "../lib/firebase.ts";

export const sendNotification = async (token: string, title: string, body: string) => {
  try {
    const message = {
      token,
      notification: { title, body },
    };
    await messaging.send(message);
  } catch (error) {
    console.error(error);
  }
}