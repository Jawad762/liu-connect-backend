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
  deleteMyAccount,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from '../controllers/user.controller.ts';
import { authMiddleware } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.use(authMiddleware);

router.get('/me', getMe);
router.patch('/me', updateProfile);
router.delete('/me', deleteMyAccount);
router.post('/me/push-token', addPushToken);
router.get('/me/blocked', getBlockedUsers);
router.get('/search', search);
router.get('/:id', getUserById);
router.post('/:id/follow', followUser);
router.delete('/:id/follow', unfollowUser);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);
router.post('/:id/block', blockUser);
router.delete('/:id/block', unblockUser);

export default router;
