import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.route.ts';
import usersRoutes from './routes/users.route.ts';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});