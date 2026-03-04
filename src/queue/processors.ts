import type { Job } from "bullmq";
import { sendEmail } from "../lib/sendgrid.ts";
import { sendNotification } from "../utils/firebase.utils.ts";

export interface EmailJobData {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface NotificationJobData {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, text, html } = job.data;
  if (!to || !subject || !text || !html) {
    throw new Error("To, subject, text, and html are required");
  }
  await sendEmail(to, subject, text, html);
}

export async function processNotificationJob(
  job: Job<NotificationJobData>,
): Promise<void> {
  const { token, title, body, data } = job.data;
  if (!token || !title || !body) {
    throw new Error("Token, title, and body are required");
  }
  await sendNotification(token, title, body, data);
}
