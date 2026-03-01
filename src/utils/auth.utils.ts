import { randomInt } from 'crypto';

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

export const sendVerificationEmail = async (email: string, code: string): Promise<void> => {
  // TODO: Configure nodemailer or your email provider
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail({ to: email, subject: 'Verify your email', html: `Your code: ${code}` });
  console.log(`[Email] Verification code for ${email}: ${code}`);
};

export const sendPasswordResetEmail = async (email: string, code: string): Promise<void> => {
  // TODO: Configure nodemailer - send 6-digit code for mobile input
  // await transporter.sendMail({ to: email, subject: 'Reset your password', html: `Your code: ${code}` });
  console.log(`[Email] Password reset code for ${email}: ${code}`);
};