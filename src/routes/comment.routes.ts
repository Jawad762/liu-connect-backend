import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.ts';
import { createComment, deleteComment, getComments, likeComment, unlikeComment, updateComment } from '../controllers/comment.controller.ts';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createComment);
router.get('/', getComments);
router.put('/:publicId', updateComment);
router.delete('/:publicId', deleteComment);
router.patch('/:publicId/like', likeComment);
router.patch('/:publicId/unlike', unlikeComment);

export default router;