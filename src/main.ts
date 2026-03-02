import config from './config.ts';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.ts';
import usersRoutes from './routes/user.routes.ts';
import notificationRoutes from './routes/notification.routes.ts';
import postRoutes from './routes/post.routes.ts';
import commentRoutes from './routes/comment.routes.ts';
import communityRoutes from './routes/community.routes.ts';
import cors from 'cors';

const app = express();

// no cors policies required because the api is only used by the mobile app
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use("/api/communities", communityRoutes);

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}`);
});