import config from './config.ts';
import logger from './lib/logger.ts';
import { prisma } from './lib/prisma.ts';
import { redis } from './queue/connection.ts';
import { errorResponse } from './dtos/base.dto.ts';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.ts';
import usersRoutes from './routes/user.routes.ts';
import notificationRoutes from './routes/notification.routes.ts';
import postRoutes from './routes/post.routes.ts';
import commentRoutes from './routes/comment.routes.ts';
import communityRoutes from './routes/community.routes.ts';
import healthRoutes from './routes/health.routes.ts';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { uploadthingRouter } from './lib/uploadthing.ts';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX } from './constants.ts';

const app = express();
app.set('trust proxy', 1);

const rateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS, // 1 minute
  max: RATE_LIMIT_MAX, // 100 requests per 1 minute per IP
  handler: (_req, res) => {
    res.status(429).json(errorResponse('Too many requests, please try again later.'));
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: AUTH_RATE_LIMIT_MAX, // 100 requests per 15 minutes per IP for auth
  handler: (_req, res) => {
    res.status(429).json(errorResponse('Too many requests, please try again later.'));
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', rateLimiter, healthRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', rateLimiter, usersRoutes);
app.use('/api/notifications', rateLimiter, notificationRoutes);
app.use('/api/posts', rateLimiter, postRoutes);
app.use('/api/comments', rateLimiter, commentRoutes);
app.use('/api/communities', rateLimiter, communityRoutes);
app.use("/api/uploadthing", uploadthingRouter);

app.use((_req, _res, next) => {
  next(new Error('Not Found'));
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const status = err.message === 'Not Found' ? 404 : 500;
  const message = err.message === 'Not Found' ? 'Not found' : 'Internal server error';

  logger.error(
    { err, method: req.method, path: req.path, status },
    'Request error'
  );

  if (res.headersSent) {
    return;
  }
  res.status(status).json(errorResponse(message));
});

const server = app.listen(config.PORT, () => {
  logger.info(`Server is running on port ${config.PORT}`);
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(async () => {
    try {
      await redis.quit();
      logger.info('Redis connection closed');
    } catch (err) {
      logger.error({ err }, 'Error closing Redis');
    }
    try {
      await prisma.$disconnect();
      logger.info('Database disconnected');
    } catch (err) {
      logger.error({ err }, 'Error disconnecting from database');
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
