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
  suggestCommunities,
  joinMultipleCommunities,
} from '../controllers/community.controller.ts';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getCommunities);
router.post('/', createCommunity);
router.post('/suggestions', suggestCommunities);
router.post('/join-multiple', joinMultipleCommunities);
router.get('/:id', getCommunity);
router.put('/:id', updateCommunity);
router.delete('/:id', deleteCommunity);
router.post('/:id/join', joinCommunity);
router.delete('/:id/join', leaveCommunity);

export default router;