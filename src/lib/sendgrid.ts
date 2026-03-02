import sgMail from '@sendgrid/mail';
import config from '../config.ts';

sgMail.setApiKey(config.SENDGRID_API_KEY);

export const sendEmail = async (to: string, subject: string, text: string, html: string) => {
  const msg = {
    to,
    from: config.SENDGRID_FROM_EMAIL,
    subject,
    text,
    html,
  };

  await sgMail.send(msg);
};