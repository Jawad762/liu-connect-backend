import { randomInt } from 'crypto';
import { sendEmail } from '../lib/sendgrid.ts';

export const validateEmail = (email: string) => {
  if (!email) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) return false;

  if (!email.endsWith('@students.liu.edu.lb')) return false;

  return true;
};

export const validatePassword = (password: string) => {
  if (!password) return false;

  if (password.length < 8) return false;

  return true;
};

export const validateName = (name: string) => {
  if (!name) return false;

  if (name.length < 2) return false;

  return true;
};

export const generateVerificationCode = (): string => {
  return Array.from({ length: 6 }, () => randomInt(0, 10)).join('');
};

export const validateCode = (code: string): boolean => {
  if (!code || typeof code !== 'string') return false;
  return /^\d{6}$/.test(code);
};

const buildCodeEmailHtml = (options: {
  title: string;
  description: string;
  codeLabel: string;
  code: string;
  footerNote: string;
}) => {
  const { title, description, codeLabel, code, footerNote } = options;

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f4f5;padding:24px 0;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(15,23,42,0.08);">
              <tr>
                <td style="padding:20px 24px 16px;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#eff6ff;">
                  <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">LIU Connect</div>
                  <div style="margin-top:4px;font-size:13px;opacity:0.9;">${title}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 24px 8px;color:#0f172a;">
                  <p style="margin:0 0 12px;font-size:14px;">Hi there,</p>
                  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
                    ${description}
                  </p>
                  <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${codeLabel}</p>
                  <div style="display:inline-block;padding:12px 20px;border-radius:9999px;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#eff6ff;font-size:24px;letter-spacing:0.35em;font-weight:700;">
                    <span style="letter-spacing:0.35em;">${code}</span>
                  </div>
                  <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
                    ${footerNote}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px 20px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;line-height:1.5;">
                  <p style="margin:0 0 4px;">
                    If you didn’t request this, you can safely ignore this email.
                  </p>
                  <p style="margin:0;">
                    Sent from LIU Connect • Beirut, Lebanon
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
};

export const sendVerificationEmail = async (email: string, code: string): Promise<void> => {
  const subject = 'Verify your LIU Connect email';
  const text = `Your LIU Connect verification code is ${code}. It expires in 5 minutes.`;
  const html = buildCodeEmailHtml({
    title: 'Verify your email address',
    description: 'Welcome to LIU Connect! Use the verification code below to confirm your university email address and activate your account.',
    codeLabel: 'Your 6-digit verification code:',
    code,
    footerNote: 'For security reasons, this code will expire in 5 minutes. Enter it on the verification screen in the LIU Connect app.',
  });

  await sendEmail(email, subject, text, html);
};

export const sendPasswordResetEmail = async (email: string, code: string): Promise<void> => {
  const subject = 'Reset your LIU Connect password';
  const text = `Your LIU Connect password reset code is ${code}. It expires in 1 hour.`;
  const html = buildCodeEmailHtml({
    title: 'Reset your password',
    description: 'We received a request to reset the password for your LIU Connect account. Use the code below to proceed with resetting your password.',
    codeLabel: 'Your 6-digit reset code:',
    code,
    footerNote: 'This code will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.',
  });

  await sendEmail(email, subject, text, html);
};