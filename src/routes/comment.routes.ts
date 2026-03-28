import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.ts';
import { bookmarkComment, createComment, deleteComment, getBookmarks, getComment, getComments, likeComment, reportComment, unbookmarkComment, unlikeComment, updateComment } from '../controllers/comment.controller.ts';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createComment);
router.get('/', getComments);
router.get('/bookmarks', getBookmarks);
router.post('/:id/bookmark', bookmarkComment);
router.delete('/:id/unbookmark', unbookmarkComment);
router.get('/:id', getComment);
router.put('/:id', updateComment);
router.delete('/:id', deleteComment);
router.post('/:id/like', likeComment);
router.delete('/:id/unlike', unlikeComment);
router.post('/:id/report', reportComment);

export default router;