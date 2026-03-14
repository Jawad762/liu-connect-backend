import express from 'express';
import { createPost, deletePost, getPost, getPosts, likePost, unlikePost, updatePost } from '../controllers/post.controller.ts';
import { authMiddleware } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getPosts);
router.post('/', createPost);
router.get('/:id', getPost);
router.put('/:id', updatePost);
router.patch('/like', likePost);
router.patch('/unlike', unlikePost);
router.delete('/:id', deletePost);

export default router;
