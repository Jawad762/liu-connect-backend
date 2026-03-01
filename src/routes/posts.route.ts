import express from 'express';
import { createPost, getPosts, likePost, unlikePost } from '../controllers/posts.controller.ts';
import { authMiddleware } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.get('/', getPosts);
router.post('/', createPost);
// router.get('/:id', getPostById);
// router.put('/:id', updatePost);
router.patch('/:id/like', likePost);
router.patch('/:id/unlike', unlikePost);
// router.delete('/:id', deletePost);

router.use(authMiddleware);

export default router;