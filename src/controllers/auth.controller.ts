import { Request, Response } from "express";
import { errorResponse, IRequestBody, successResponse } from "../dtos/base.dto.ts";
import {
  generateVerificationCode,
  sendPasswordResetEmail,
  sendVerificationEmail,
  validateCode,
  validateEmail,
  validatePassword,
} from "../utils/auth.utils.ts";
import { prisma } from "../lib/prisma.ts";
import bcrypt from "bcrypt";
import {
  IChangePasswordBody,
  IForgotPasswordBody,
  IResendVerificationBody,
  IResetPasswordBody,
  ISignInBody,
  ISignUpBody,
  IVerifyEmailBody,
} from "../dtos/auth.dto.ts";
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from "../config.ts";

export const signUp = async (req: IRequestBody<ISignUpBody>, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!validateEmail(email)) return res.status(400).json(errorResponse('Invalid email'));
    if (!validatePassword(password)) return res.status(400).json(errorResponse('Invalid password'));

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json(errorResponse('Email already registered'));

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();
    const codeExpiration = new Date(Date.now() + 5 * 60 * 1000);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        verify_email_token: verificationCode,
        verify_email_expires: codeExpiration,
      },
    });
    await sendVerificationEmail(user.email, verificationCode);

    res.status(201).json(successResponse(undefined, 'User created. Check your email for the verification code.'));
  } catch (error) {
    return res.status(500).json(errorResponse('Internal server error'));
  }
};

export const signIn = async (req: IRequestBody<ISignInBody>, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!validateEmail(email)) return res.status(400).json(errorResponse('Invalid email'));
    if (!validatePassword(password)) return res.status(400).json(errorResponse('Invalid password'));

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json(errorResponse('Invalid email or password'));
    if (user.is_deleted) return res.status(401).json(errorResponse('Account is deactivated'));
    if (!user.is_verified) return res.status(403).json(errorResponse('Please verify your email before signing in'));
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json(errorResponse('Invalid email or password'));
    const accessToken = jwt.sign({ id: user.id, publicId: user.publicId }, config.ACCESS_TOKEN_SECRET, { expiresIn: '30m' });
    const refreshToken = jwt.sign({ id: user.id, publicId: user.publicId }, config.REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
    await prisma.user.update({
      where: { id: user.id },
      data: { refresh_token: refreshToken },
    });
    const responseUser = {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      school: user.school,
      major: user.major,
      followers_count: user.followers_count,
      following_count: user.following_count,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.status(200).json(successResponse({ user: responseUser, accessToken }, 'Signed in successfully'));
  } catch (error) {
    return res.status(500).json(errorResponse('Internal server error'));
  }
};

export const signOut = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json(errorResponse('Unauthorized'));
    const decoded = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET) as JwtPayload;
    if (!decoded) return res.status(401).json(errorResponse('Unauthorized'));
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json(errorResponse('Unauthorized'));
    if (user.refresh_token === refreshToken) {
      await prisma.user.update({ where: { id: user.id }, data: { refresh_token: null } });
    }
    res.clearCookie('refreshToken');
    res.status(200).json(successResponse(undefined, 'Signed out successfully'));
  } catch (error) {
    return res.status(500).json(errorResponse('Internal server error'));
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json(errorResponse('Unauthorized'));
    const decoded = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET) as JwtPayload;
    if (!decoded) return res.status(401).json(errorResponse('Unauthorized'));
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.is_deleted || !user.refresh_token || user.refresh_token !== refreshToken) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }
    const accessToken = jwt.sign({ id: user.id, publicId: user.publicId }, config.ACCESS_TOKEN_SECRET, { expiresIn: '30m' });
    res.status(200).json(successResponse({ accessToken }, 'Token refreshed successfully'));
  } catch (error) {
    return res.status(500).json(errorResponse('Internal server error'));
  }
};

export const verifyEmail = async (req: IRequestBody<IVerifyEmailBody>, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!validateEmail(email)) return res.status(400).json(errorResponse('Invalid email'));
    if (!validateCode(code)) return res.status(400).json(errorResponse('Invalid code format'));

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json(errorResponse('User not found'));
    if (user.is_verified) return res.status(400).json(errorResponse('Email already verified'));
    if (!user.verify_email_token || !user.verify_email_expires) {
      return res.status(400).json(errorResponse('No verification pending. Request a new code.'));
    }
    if (user.verify_email_expires < new Date()) {
      return res.status(400).json(errorResponse('Verification code expired. Request a new one.'));
    }
    if (user.verify_email_token !== code) {
      return res.status(400).json(errorResponse('Invalid verification code'));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { is_verified: true, verify_email_token: null, verify_email_expires: null },
    });

    res.status(200).json(successResponse(undefined, 'Email verified successfully'));
  } catch (error) {
    return res.status(500).json(errorResponse('Internal server error'));
  }
};

export const resendVerificationCode = async (req: IRequestBody<IResendVerificationBody>, res: Response) => {
  try {
    const { email } = req.body;
    if (!validateEmail(email)) return res.status(400).json(errorResponse('Invalid email'));

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json(errorResponse('User not found'));
    if (user.is_verified) return res.status(400).json(errorResponse('Email already verified'));

    const verificationCode = generateVerificationCode();
    const codeExpiration = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { verify_email_token: verificationCode, verify_email_expires: codeExpiration },
    });
    await sendVerificationEmail(user.email, verificationCode);

    res.status(200).json(successResponse(undefined, 'Verification code sent'));
  } catch (error) {
    return res.status(500).json(errorResponse('Internal server error'));
  }
};

export const forgotPassword = async (req: IRequestBody<IForgotPasswordBody>, res: Response) => {
  try {
    const { email } = req.body;
    if (!validateEmail(email)) return res.status(400).json(errorResponse('Invalid email'));

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.is_deleted) {
      return res.status(200).json(successResponse(undefined, 'If an account exists, you will receive a reset code'));
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { reset_password_token: code, reset_password_expires: expiresAt },
    });
    await sendPasswordResetEmail(user.email, code);

    res.status(200).json(successResponse(undefined, 'If an account exists, you will receive a reset code'));
  } catch (error) {
    return res.status(500).json(errorResponse('Internal server error'));
  }
};

export const resetPassword = async (req: IRequestBody<IResetPasswordBody>, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!validateEmail(email)) return res.status(400).json(errorResponse('Invalid email'));
    if (!validateCode(code)) return res.status(400).json(errorResponse('Invalid code format'));
    if (!validatePassword(newPassword)) return res.status(400).json(errorResponse('Invalid password'));

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json(errorResponse('User not found'));
    if (!user.reset_password_token || !user.reset_password_expires) {
      return res.status(400).json(errorResponse('No password reset requested. Request a new code.'));
    }
    if (user.reset_password_expires < new Date()) {
      return res.status(400).json(errorResponse('Reset code expired. Request a new one.'));
    }
    if (user.reset_password_token !== code) {
      return res.status(400).json(errorResponse('Invalid reset code'));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, reset_password_token: null, reset_password_expires: null },
    });

    res.status(200).json(successResponse(undefined, 'Password reset successfully'));
  } catch (error) {
    return res.status(500).json(errorResponse('Internal server error'));
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json(errorResponse('Unauthorized'));

    const { currentPassword, newPassword } = req.body as IChangePasswordBody;
    if (!validatePassword(currentPassword) || !validatePassword(newPassword)) {
      return res.status(400).json(errorResponse('Invalid password'));
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json(errorResponse('Unauthorized'));
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) return res.status(401).json(errorResponse('Current password is incorrect'));

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.status(200).json(successResponse(undefined, 'Password changed successfully'));
  } catch (error) {
    return res.status(500).json(errorResponse('Internal server error'));
  }
};