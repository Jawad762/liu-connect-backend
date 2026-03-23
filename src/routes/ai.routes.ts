import express from 'express';
import { analyzeSchedule } from '../controllers/ai.controller.ts';
import { authMiddleware } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.use(authMiddleware);
router.post('/analyze-schedule', analyzeSchedule);

export default router;