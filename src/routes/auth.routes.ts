import express from 'express';
import {
  changePassword,
  forgotPassword,
  refreshToken,
  resendVerificationCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
  verifyEmail,
} from '../controllers/auth.controller.ts';
import { authMiddleware } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', authMiddleware, signOut);
router.post('/refresh', refreshToken);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authMiddleware, changePassword);

export default router;