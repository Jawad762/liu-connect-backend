import express from 'express';
import { createPost, deletePost, getPost, getPosts, likePost, unlikePost, updatePost } from '../controllers/post.controller.ts';
import { authMiddleware } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getPosts);
router.post('/', createPost);
router.get('/:publicId', getPost);
router.put('/:publicId', updatePost);
router.patch('/like', likePost);
router.patch('/unlike', unlikePost);
router.delete('/:publicId', deletePost);

export default router;
