import { Router } from 'express';
import { prisma } from '../lib/prisma.ts';
import logger from '../lib/logger.ts';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).json({ status: 'unavailable' });
  }
});

export default router;
