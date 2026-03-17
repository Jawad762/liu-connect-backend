import { Response } from "express";
import { errorResponse, IAuthRequest, IAuthRequestBody, successResponse } from "../dtos/base.dto.ts";
import { prisma } from "../lib/prisma.ts";
import { ICreateCommentBody, IUpdateCommentBody } from "../dtos/comment.dto.ts";
import { getRouteParam } from "../utils/request.utils.ts";
import { BookmarkableType, NotificationType } from "../../generated/prisma/enums.ts";
import { enqueuePushNotifications } from "../queue/enqueuePushNotifications.ts";
import logger from "../lib/logger.ts";
import { validatePost } from "../utils/post.utils.ts";

export const createComment = async (req: IAuthRequestBody<ICreateCommentBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const { postId: bodyPostId, content, media: rawMedia, parentCommentId } = req.body;
        const media = rawMedia ?? [];
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!bodyPostId) return res.status(400).json(errorResponse("Post ID is required"));

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        if (!user) return res.status(404).json(errorResponse("User not found"));

        const commentValidation = validatePost(content, media);
        if (!commentValidation.success) return res.status(400).json(errorResponse(commentValidation.message));

        const post = await prisma.post.findFirst({
            where: { id: bodyPostId, is_deleted: false },
            select: { id: true, userId: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));

        let parentId: string | null = null;
        let parentUserId: string | null = null;
        if (parentCommentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: parentCommentId },
                select: { id: true, postId: true, is_deleted: true, userId: true },
            });
            if (!parent || parent.is_deleted) {
                return res.status(404).json(errorResponse("Parent comment not found"));
            }
            if (parent.postId !== post.id) {
                return res.status(400).json(errorResponse("Parent comment does not belong to this post"));
            }
            parentId = parent.id;
            parentUserId = parent.userId;
        }

        const comment = await prisma.$transaction(async (tx) => {
            const newComment = await tx.comment.create({
                data: {
                    content,
                    userId,
                    postId: post.id,
                    media: { create: media.map(m => ({ media_url: m.url, type: m.type })) },
                    parentId,
                },
            });
            await tx.post.update({
                where: { id: post.id },
                data: { comments_count: { increment: 1 } },
            });
            if (parentId) {
                await tx.comment.update({
                    where: { id: parentId },
                    data: { replies_count: { increment: 1 } },
                });
            }
            return newComment;
        });

        if (parentId && parentUserId !== null) {
            if (parentUserId !== userId) {
                const notificationTitle = `${user.name ?? "Someone"} replied to your comment`;
                const notificationBody = "You have a new reply to your comment";
                const redirectPath = `/posts/${post.id}`;

                await prisma.notification.create({
                    data: {
                        type: NotificationType.COMMENT,
                        title: notificationTitle,
                        redirect_url: redirectPath,
                        userId: parentUserId,
                        postId: post.id,
                        commentId: comment.id,
                    },
                });

                const pushTokens = await prisma.pushToken.findMany({
                    where: { userId: parentUserId },
                });
                enqueuePushNotifications(pushTokens, notificationTitle, notificationBody, {
                    type: NotificationType.COMMENT,
                    entity: "comment_reply",
                    postId: post.id,
                    commentId: comment.id,
                    parentCommentId: parentId,
                    actorId: req.user?.id ?? "",
                    actorName: user.name ?? "",
                });
            }
        } else {
            if (post.userId !== userId) {
                const notificationTitle = `${user.name ?? "Someone"} commented on your post`;
                const notificationBody = "You have a new comment on your post";
                const redirectPath = `/posts/${post.id}`;

                await prisma.notification.create({
                    data: {
                        type: NotificationType.COMMENT,
                        title: notificationTitle,
                        redirect_url: redirectPath,
                        userId: post.userId,
                        postId: post.id,
                        commentId: comment.id,
                    },
                });

                const pushTokens = await prisma.pushToken.findMany({
                    where: { userId: post.userId },
                });
                enqueuePushNotifications(pushTokens, notificationTitle, notificationBody, {
                    type: NotificationType.COMMENT,
                    entity: "comment",
                    postId: post.id,
                    commentId: comment.id,
                    actorId: req.user?.id ?? "",
                    actorName: user.name ?? "",
                });
            }
        }

        return res.status(201).json(successResponse(comment));
    }
    catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
}

export const getComments = async (req: IAuthRequest, res: Response) => {
    try {
        const currentUserId = req.user?.id;
        if (!currentUserId) return res.status(401).json(errorResponse("Unauthorized"));
        const { page = 1, size = 10, postId: queryPostId, userId: queryUserId, parentCommentId } = req.query;

        if (!queryPostId && !queryUserId) return res.status(400).json(errorResponse("Post ID or User ID is required"));

        let post = null;
        if (queryPostId) {
            post = await prisma.post.findFirst({
                where: { id: queryPostId as string, is_deleted: false },
                select: { id: true },
            });
            if (!post) return res.status(404).json(errorResponse("Post not found"));
        }

        // Build base where clause: non-deleted comments OR deleted comments that have replies
        const where = {
            ...(post ? { postId: post.id } : {}),
            ...(queryUserId != null && { userId: queryUserId as string }),
            OR: [
                { is_deleted: false },
                { is_deleted: true, replies: { some: {} } },
            ],
        } as {
            postId?: string;
            userId?: string;
            OR: Array<{ is_deleted: boolean; replies?: { some: Record<string, never> } }>;
            parentId?: string | null;
        };

        // If parentCommentId is provided, return replies to that comment.
        // Otherwise, return only top-level comments.
        if (parentCommentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: parentCommentId as string },
                select: { id: true, postId: true },
            });
            if (!parent || parent.postId !== post?.id) {
                return res.status(404).json(errorResponse("Parent comment not found"));
            }
            where.parentId = parent.id;
        } else {
            where.parentId = null;
        }

        const comments = await prisma.comment.findMany({
            where,
            orderBy: {
                createdAt: "desc",
            },
            skip: (Number(page) - 1) * Number(size),
            take: Number(size),
            include: {
                user: { select: { id: true, name: true, avatar_url: true } },
                media: { select: { id: true, media_url: true, type: true } },
            },
        });

        const commentIds = comments.map(c => c.id);

        const likes = await prisma.commentLike.findMany({
            where: { commentId: { in: commentIds }, userId: currentUserId },
            select: { commentId: true },
        });
        const likedCommentIds = new Set(likes.map(l => l.commentId));

        const bookmarks = await prisma.bookmark.findMany({
            where: { userId: currentUserId, type: BookmarkableType.COMMENT, entityId: { in: commentIds } },
            select: { entityId: true },
        });
        const bookmarkedCommentIds = new Set(bookmarks.map(b => b.entityId));

        const mappedComments = comments.map(c => ({
            ...c,
            isLiked: likedCommentIds.has(c.id),
            isBookmarked: bookmarkedCommentIds.has(c.id),
        }));

        return res.status(200).json(successResponse(mappedComments));
    }
    catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
}

export const getComment = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        const id = getRouteParam(req, "id");
        if (!id) return res.status(400).json(errorResponse("Comment ID is required"));
        const comment = await prisma.comment.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, avatar_url: true } },
                media: { select: { id: true, media_url: true, type: true } }
            },
        });
        if (!comment) return res.status(404).json(errorResponse("Comment not found"));
        const isLiked = await prisma.commentLike.findUnique({
            where: { commentId_userId: { commentId: comment.id, userId } },
        });
        const isBookmarked = await prisma.bookmark.findUnique({
            where: { userId_type_entityId: { userId, type: BookmarkableType.COMMENT, entityId: comment.id } },
        });
        return res.status(200).json(successResponse({ ...comment, isLiked: !!isLiked, isBookmarked: !!isBookmarked }));
    }
    catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
}

export const likeComment = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const id = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!id) return res.status(400).json(errorResponse("Comment ID is required"));

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        if (!user) return res.status(404).json(errorResponse("User not found"));

        const comment = await prisma.comment.findUnique({
            where: { id },
            select: { id: true, userId: true, postId: true, post: { select: { id: true } } },
        });
        if (!comment) return res.status(404).json(errorResponse("Comment not found"));

        const notificationTitle = `${user.name ?? "Someone"} liked your comment`;
        const notificationBody = "You have a new like on your comment";
        const redirectPath = `/posts/${comment.post.id}`;

        await prisma.$transaction([
            prisma.commentLike.create({
                data: { commentId: comment.id, userId },
            }),
            prisma.comment.update({
                where: { id: comment.id },
                data: { likes_count: { increment: 1 } },
            }),
        ]);

        if (comment.userId !== userId) {
            await prisma.notification.create({
                data: {
                    type: NotificationType.LIKE,
                    title: notificationTitle,
                    redirect_url: redirectPath,
                    userId: comment.userId,
                    postId: comment.postId,
                    commentId: comment.id,
                },
            });

            const pushTokens = await prisma.pushToken.findMany({
                where: { userId: comment.userId },
            });
            enqueuePushNotifications(pushTokens, notificationTitle, notificationBody, {
                type: NotificationType.LIKE,
                entity: "comment",
                postId: comment.post.id,
                commentId: comment.id,
                actorId: req.user?.id ?? "",
                actorName: user.name ?? "",
            });
        }

        return res.status(200).json(successResponse(undefined, "Liked comment"));
    }
    catch (error) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2002") {
            return res.status(200).json(successResponse(undefined, "Already liked"));
        }
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
}

export const unlikeComment = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const id = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!id) return res.status(400).json(errorResponse("Comment ID is required"));

        const comment = await prisma.comment.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!comment) return res.status(404).json(errorResponse("Comment not found"));

        await prisma.$transaction(async (tx) => {
            const deleted = await tx.commentLike.deleteMany({
                where: { commentId: comment.id, userId },
            });
            if (deleted.count > 0) {
                await tx.comment.update({
                    where: { id: comment.id },
                    data: { likes_count: { decrement: 1 } },
                });
            }
        });

        return res.status(200).json(successResponse(undefined, "Unliked comment"));
    }
    catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
}

export const updateComment = async (req: IAuthRequestBody<IUpdateCommentBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const id = getRouteParam(req, "id");
        const { content, media: rawMedia } = req.body;
        const media = rawMedia ?? [];
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!id) return res.status(400).json(errorResponse("Comment ID is required"));

        const commentValidation = validatePost(content, media);
        if (!commentValidation.success) return res.status(400).json(errorResponse(commentValidation.message));

        const comment = await prisma.comment.findFirst({
            where: { id, is_deleted: false },
            select: { id: true, userId: true },
        });
        if (!comment) return res.status(404).json(errorResponse("Comment not found"));
        if (comment.userId !== userId) return res.status(403).json(errorResponse("Forbidden"));

        await prisma.comment.update({
            where: { id: comment.id },
            data: {
                content,
                media: {
                    deleteMany: {},
                    create: media.map(m => ({ media_url: m.url, type: m.type })),
                },
            },
        });

        return res.status(200).json(successResponse(undefined, "Comment updated"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const deleteComment = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const id = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!id) return res.status(400).json(errorResponse("Comment ID is required"));

        const comment = await prisma.comment.findUnique({
            where: { id },
            select: { id: true, userId: true, parentId: true, postId: true },
        });
        if (!comment) return res.status(404).json(errorResponse("Comment not found"));
        if (comment.userId !== userId) return res.status(403).json(errorResponse("Forbidden"));

        const deletedAt = new Date();
        await prisma.$transaction([
            prisma.comment.update({
                where: { id: comment.id },
                data: { is_deleted: true, deleted_at: deletedAt },
            }),
            prisma.post.update({
                where: { id: comment.postId },
                data: { comments_count: { decrement: 1 } },
            }),
            ...(comment.parentId ? [prisma.comment.update({
                where: { id: comment.parentId },
                data: { replies_count: { decrement: 1 } },
            })] : []),
        ]);

        return res.status(200).json(successResponse(undefined, "Comment deleted"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const getBookmarks = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { page: rawPage, size: rawSize } = req.query;
        const pageNumber = Math.max(1, parseInt(rawPage as string) || 1);
        const sizeNumber = Math.min(30, Math.max(1, parseInt(rawSize as string) || 20));
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

        const bookmarks = await prisma.bookmark.findMany({
            where: { userId, type: BookmarkableType.COMMENT },
            orderBy: { createdAt: "desc" },
            skip: (pageNumber - 1) * sizeNumber,
            take: sizeNumber,
            select: { entityId: true },
        });

        const commentIds = bookmarks.map((b) => b.entityId);
        if (commentIds.length === 0) {
            return res.status(200).json(successResponse([]));
        }

        const comments = await prisma.comment.findMany({
            where: { id: { in: commentIds }, is_deleted: false },
            include: {
                user: { select: { id: true, name: true, avatar_url: true } },
                media: { select: { id: true, media_url: true, type: true } },
            },
        });
        const commentById = new Map(comments.map((c) => [c.id, c]));
        const commentsInOrder = commentIds.map((id) => commentById.get(id)).filter(Boolean) as typeof comments;
        const likes = await prisma.commentLike.findMany({
            where: { commentId: { in: commentsInOrder.map((c) => c.id) }, userId },
            select: { commentId: true },
        });
        const likedCommentIds = new Set(likes.map((l) => l.commentId));
        const commentsWithMeta = commentsInOrder.map((comment) => ({
            ...comment,
            isLiked: likedCommentIds.has(comment.id),
            isBookmarked: true,
        }));

        return res.status(200).json(successResponse(commentsWithMeta));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const bookmarkComment = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const commentId = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!commentId) return res.status(400).json(errorResponse("Comment ID is required"));

        const existing = await prisma.bookmark.findUnique({
            where: { userId_type_entityId: { userId, type: BookmarkableType.COMMENT, entityId: commentId } },
        });
        if (existing) {
            return res.status(200).json(successResponse(undefined, "Already bookmarked"));
        }

        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: { id: true, is_deleted: true },
        });
        if (!comment || comment.is_deleted) return res.status(404).json(errorResponse("Comment not found"));

        await prisma.bookmark.create({
            data: { userId, type: BookmarkableType.COMMENT, entityId: commentId },
        });
        return res.status(201).json(successResponse(undefined, "Bookmarked comment"));
    } catch (error) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2002") return res.status(200).json(successResponse(undefined, "Already bookmarked"));
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const unbookmarkComment = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const commentId = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!commentId) return res.status(400).json(errorResponse("Comment ID is required"));

        const bookmark = await prisma.bookmark.findUnique({
            where: { userId_type_entityId: { userId, type: BookmarkableType.COMMENT, entityId: commentId } },
        });
        if (!bookmark) {
            return res.status(200).json(successResponse(undefined, "Not bookmarked"));
        }
        await prisma.bookmark.delete({ where: { id: bookmark.id } });
        return res.status(200).json(successResponse(undefined, "Unbookmarked comment"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};