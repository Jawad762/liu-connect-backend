import express from 'express';
import {
  addPushToken,
  followUser,
  getFollowers,
  getFollowing,
  getMe,
  getUserByPublicId,
  unfollowUser,
  updateProfile,
} from '../controllers/user.controller.ts';
import { authMiddleware } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.use(authMiddleware);

router.get('/me', getMe);
router.patch('/me', updateProfile);
router.post('/me/push-token', addPushToken);
router.get('/:publicId', getUserByPublicId);
router.post('/:publicId/follow', followUser);
router.delete('/:publicId/follow', unfollowUser);
router.get('/:publicId/followers', getFollowers);
router.get('/:publicId/following', getFollowing);

export default router;
