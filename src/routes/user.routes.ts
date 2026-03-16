import express from 'express';
import {
  addPushToken,
  followUser,
  getFollowers,
  getFollowing,
  getMe,
  getUserById,
  search,
  unfollowUser,
  updateProfile,
} from '../controllers/user.controller.ts';
import { authMiddleware } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.use(authMiddleware);

router.get('/me', getMe);
router.patch('/me', updateProfile);
router.post('/me/push-token', addPushToken);
router.get('/search', search);
router.get('/:id', getUserById);
router.post('/:id/follow', followUser);
router.delete('/:id/follow', unfollowUser);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);

export default router;
