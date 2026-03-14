import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.ts';
import { createComment, deleteComment, getComment, getComments, likeComment, unlikeComment, updateComment } from '../controllers/comment.controller.ts';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createComment);
router.get('/', getComments);
router.get('/:id', getComment);
router.put('/:id', updateComment);
router.delete('/:id', deleteComment);
router.patch('/:id/like', likeComment);
router.patch('/:id/unlike', unlikeComment);

export default router;