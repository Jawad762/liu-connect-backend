import config from './config.ts';
import logger from './lib/logger.ts';
import { prisma } from './lib/prisma.ts';
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

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/communities', communityRoutes);

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
