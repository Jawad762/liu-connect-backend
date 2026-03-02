import express from 'express';
import { authMiddleware } from "../middleware/auth.middleware.ts";
import {
  getCommunities,
  createCommunity,
  getCommunity,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
} from '../controllers/community.controller.ts';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getCommunities);
router.post('/', createCommunity);
router.get('/:publicId', getCommunity);
router.put('/:publicId', updateCommunity);
router.delete('/:publicId', deleteCommunity);
router.post('/:publicId/join', joinCommunity);
router.delete('/:publicId/join', leaveCommunity);

export default router;