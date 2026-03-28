import express from 'express';
import { bookmarkPost, createPost, deletePost, getBookmarks, getPost, getPosts, likePost, reportPost, search, unbookmarkPost, unlikePost, updatePost } from '../controllers/post.controller.ts';
import { authMiddleware } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getPosts);
router.post('/', createPost);
router.get('/bookmarks', getBookmarks);
router.get('/search', search);
router.post('/:id/bookmark', bookmarkPost);
router.delete('/:id/unbookmark', unbookmarkPost);
router.post('/:id/like', likePost);
router.delete('/:id/unlike', unlikePost);
router.post('/:id/report', reportPost);
router.get('/:id', getPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

export default router;
