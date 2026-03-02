import { Response } from "express";
import { errorResponse, IAuthRequest, IAuthRequestBody, successResponse } from "../dtos/base.dto.ts";
import { validateContent } from "../utils/post.utils.ts";
import { prisma } from "../lib/prisma.ts";
import { ICreateCommentBody, IUpdateCommentBody } from "../dtos/comment.dto.ts";
import { getRouteParam } from "../utils/request.utils.ts";
import { sendNotification } from "../utils/firebase.utils.ts";
import { NotificationType } from "../../generated/prisma/enums.ts";

export const createComment = async (req: IAuthRequestBody<ICreateCommentBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const { postPublicId, content, media, parentPublicId } = req.body;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!postPublicId) return res.status(400).json(errorResponse("Post public ID is required"));

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, publicId: true },
        });
        if (!user) return res.status(404).json(errorResponse("User not found"));

        const isContentValid = validateContent(content);
        if (!isContentValid) return res.status(400).json(errorResponse("Content is invalid"));
        if (media.length > 4) return res.status(400).json(errorResponse("Maximum 4 media allowed"));

        const post = await prisma.post.findUnique({
            where: { publicId: postPublicId as string },
            select: { id: true, userId: true, publicId: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));

        let parentId = null;
        if (parentPublicId) {
            const parent = await prisma.comment.findUnique({
                where: { publicId: parentPublicId as string },
                select: { id: true, postId: true, is_deleted: true },
            });
            if (!parent || parent.is_deleted) {
                return res.status(404).json(errorResponse("Parent comment not found"));
            }
            if (parent.postId !== post.id) {
                return res.status(400).json(errorResponse("Parent comment does not belong to this post"));
            }
            parentId = parent.id;
        }
        const comment = await prisma.comment.create({
            data: {
                content,
                userId,
                postId: post.id,
                media: { create: media.map(url => ({ media_url: url })) },
                parentId,
            },
        });

        if (parentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: parentId },
                select: { userId: true, publicId: true },
            });
            if (!parent) return res.status(404).json(errorResponse("Parent comment not found"));
            if (parent.userId !== userId) {
                const notificationTitle = `${user.name ?? "Someone"} replied to your comment`;
                const notificationBody = "You have a new reply to your comment";
                const redirectPath = `/posts/${post.publicId}`;

                await prisma.notification.create({
                    data: {
                        type: NotificationType.COMMENT,
                        title: notificationTitle,
                        redirect_url: redirectPath,
                        userId: parent.userId,
                        postId: post.id,
                        commentId: comment.id,
                    },
                });

                const pushTokens = await prisma.pushToken.findMany({
                    where: { userId: parent.userId },
                });

                for (const pushToken of pushTokens) {
                    await sendNotification(
                        pushToken.token,
                        notificationTitle,
                        notificationBody,
                        {
                            type: NotificationType.COMMENT,
                            entity: "comment_reply",
                            postPublicId: post.publicId,
                            commentPublicId: comment.publicId,
                            parentCommentPublicId: parent.publicId,
                            actorPublicId: req.user?.publicId ?? "",
                            actorName: user.name ?? "",
                        },
                    );
                }
            }
        } else {
            if (post.userId !== userId) {
                const notificationTitle = `${user.name ?? "Someone"} commented on your post`;
                const notificationBody = "You have a new comment on your post";
                const redirectPath = `/posts/${post.publicId}`;

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
                for (const pushToken of pushTokens) {
                    await sendNotification(
                        pushToken.token,
                        notificationTitle,
                        notificationBody,
                        {
                            type: NotificationType.COMMENT,
                            entity: "comment",
                            postPublicId: post.publicId,
                            commentPublicId: comment.publicId,
                            actorPublicId: req.user?.publicId ?? "",
                            actorName: user.name ?? "",
                        },
                    );
                }
            }
        }

        return res.status(201).json(successResponse(comment));
    }
    catch (error) {
        return res.status(500).json(errorResponse("Internal server error"));
    }
}

export const getComments = async (req: IAuthRequest, res: Response) => {
    try {
        const { page = 1, size = 10, postPublicId, userPublicId, parentPublicId } = req.query;

        if (!postPublicId) return res.status(400).json(errorResponse("Post public ID is required"));
        const post = await prisma.post.findUnique({
            where: { publicId: postPublicId as string },
            select: { id: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));

        let userId = null;
        if (userPublicId) {
            const user = await prisma.user.findUnique({
                where: { publicId: userPublicId as string },
                select: { id: true },
            });
            if (!user) return res.status(404).json(errorResponse("User not found"));
            userId = user.id;
        }

        // Build base where clause (by post and optional user)
        const where: any = {
            postId: post.id,
            ...(userId != null && { userId }),
            is_deleted: false,
        };

        // If parentPublicId is provided, return replies to that comment.
        // Otherwise, return only top-level comments.
        if (parentPublicId) {
            const parent = await prisma.comment.findUnique({
                where: { publicId: parentPublicId as string },
                select: { id: true, is_deleted: true },
            });
            if (!parent || parent.is_deleted) {
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
                user: { select: { id: true, name: true, avatar_url: true, publicId: true } },
            },
        });
        return res.status(200).json(successResponse(comments));
    }
    catch (error) {
        return res.status(500).json(errorResponse("Internal server error"));
    }
}

export const likeComment = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const publicId = getRouteParam(req, "publicId");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!publicId) return res.status(400).json(errorResponse("Comment public ID is required"));

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, publicId: true },
        });
        if (!user) return res.status(404).json(errorResponse("User not found"));

        const comment = await prisma.comment.findUnique({
            where: { publicId: publicId as string },
            select: { id: true, publicId: true, userId: true, postId: true, post: { select: { publicId: true } } },
        });
        if (!comment) return res.status(404).json(errorResponse("Comment not found"));

        const notificationTitle = `${user.name ?? "Someone"} liked your comment`;
        const notificationBody = "You have a new like on your comment";
        const redirectPath = `/posts/${comment.post.publicId}`;

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
            for (const pushToken of pushTokens) {
                await sendNotification(
                    pushToken.token,
                    notificationTitle,
                    notificationBody,
                    {
                        type: NotificationType.LIKE,
                        entity: "comment",
                        postPublicId: comment.post.publicId,
                        commentPublicId: comment.publicId,
                        actorPublicId: req.user?.publicId ?? "",
                        actorName: user.name ?? "",
                    },
                );
            }
        }

        return res.status(200).json(successResponse(undefined, "Liked comment"));
    }
    catch (error) {
        return res.status(500).json(errorResponse("Internal server error"));
    }
}

export const unlikeComment = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const publicId = getRouteParam(req, "publicId");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!publicId) return res.status(400).json(errorResponse("Comment public ID is required"));

        const comment = await prisma.comment.findUnique({
            where: { publicId: publicId as string },
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
        return res.status(500).json(errorResponse("Internal server error"));
    }
}

export const updateComment = async (req: IAuthRequestBody<IUpdateCommentBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const publicId = getRouteParam(req, "publicId");
        const { content, media } = req.body;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!publicId) return res.status(400).json(errorResponse("Comment public ID is required"));

        const isContentValid = validateContent(content);
        if (!isContentValid) return res.status(400).json(errorResponse("Content is invalid"));
        if (media.length > 4) return res.status(400).json(errorResponse("Maximum 4 media allowed"));

        const comment = await prisma.comment.findUnique({
            where: { publicId: publicId as string },
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
                    create: media.map(url => ({ media_url: url })),
                },
            },
        });

        return res.status(200).json(successResponse(undefined, "Comment updated"));
    } catch (error) {
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const deleteComment = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const publicId = getRouteParam(req, "publicId");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!publicId) return res.status(400).json(errorResponse("Comment public ID is required"));

        const comment = await prisma.comment.findUnique({
            where: { publicId: publicId as string },
            select: { id: true, userId: true },
        });
        if (!comment) return res.status(404).json(errorResponse("Comment not found"));
        if (comment.userId !== userId) return res.status(403).json(errorResponse("Forbidden"));

        await prisma.comment.update({
            where: { id: comment.id },
            data: { is_deleted: true },
        });

        return res.status(200).json(successResponse(undefined, "Comment deleted"));
    } catch (error) {
        return res.status(500).json(errorResponse("Internal server error"));
    }
};