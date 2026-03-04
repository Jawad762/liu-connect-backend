import { errorResponse, IAuthRequest, IAuthRequestBody, successResponse } from "../dtos/base.dto.ts";
import { ICreatePostBody, ILikePostBody, IUpdatePostBody } from "../dtos/post.dto.ts";
import { prisma } from "../lib/prisma.ts";
import { Response } from "express";
import { validateContent } from "../utils/post.utils.ts";
import { getRouteParam } from "../utils/request.utils.ts";
import { NotificationType } from "../../generated/prisma/enums.ts";
import { enqueuePushNotifications } from "../queue/enqueuePushNotifications.ts";
import logger from "../lib/logger.ts";

export const getPosts = async (req: IAuthRequest, res: Response) => {
    try {
        const currentUserId = req.user?.id;
        const { page = 1, size = 10, communityPublicId, userPublicId } = req.query;

        let userId = null;
        if (userPublicId) {
            const user = await prisma.user.findUnique({
                where: { publicId: userPublicId as string },
                select: { id: true },
            });
            if (!user) return res.status(404).json(errorResponse("User not found"));
            userId = user.id;
        }

        let communityId = null;
        if (communityPublicId) {
            const community = await prisma.community.findUnique({
                where: { publicId: communityPublicId as string },
                select: { id: true },
            });
            if (!community) return res.status(404).json(errorResponse("Community not found"));
            communityId = community.id;
        }

        const posts = await prisma.post.findMany({
            where: {
                ...(communityId && { communityId }),
                ...(userId != null && { userId }),
                is_deleted: false,
            },
            orderBy: {
                createdAt: "desc",
            },
            skip: (Number(page) - 1) * Number(size),
            take: Number(size),
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar_url: true,
                        publicId: true,
                    },
                },
                community: {
                    select: {
                        id: true,
                        name: true,
                        publicId: true,
                    },
                },
                media: {
                    select: {
                        id: true,
                        media_url: true,
                    },
                }
            },
        });
        const promises = posts.map(async (post) => {
            const isLiked = await prisma.postLike.findUnique({
                where: { postId_userId: { postId: post.id, userId: currentUserId as number } },
            });
            return {
                ...post,
                isLiked: !!isLiked,
            };
        });
        const postsWithIsLiked = await Promise.all(promises);
        res.status(200).json(successResponse(postsWithIsLiked));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const createPost = async (req: IAuthRequestBody<ICreatePostBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const { content, communityPublicId, media } = req.body;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        const isContentValid = validateContent(content);
        if (!isContentValid) return res.status(400).json(errorResponse("Content is invalid"));
        if (media.length > 4) return res.status(400).json(errorResponse("Maximum 4 media allowed"));

        let communityId = null;
        if (communityPublicId) {
            const community = await prisma.community.findUnique({
                where: { publicId: communityPublicId as string },
                select: { id: true },
            });
            if (!community) return res.status(404).json(errorResponse("Community not found"));
            communityId = community.id;
        }

        const post = await prisma.post.create({
            data: {
                content,
                userId,
                communityId,
                media: { create: media.map(url => ({ media_url: url })) },
            },
        });
        res.status(201).json(successResponse(post));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const likePost = async (req: IAuthRequestBody<ILikePostBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const { publicId } = req.body;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!publicId) return res.status(400).json(errorResponse("Post public ID is required"));

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, publicId: true },
        });
        if (!user) return res.status(404).json(errorResponse("User not found"));

        const post = await prisma.post.findUnique({
            where: { publicId: publicId as string },
            select: { id: true, userId: true, publicId: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));

        const notificationTitle = `${user.name ?? "Someone"} liked your post`;
        const notificationBody = "You have a new like on your post";
        const redirectPath = `/posts/${post.publicId}`;

        await prisma.$transaction([
            prisma.postLike.create({
                data: { postId: post.id, userId },
            }),
            prisma.post.update({
                where: { id: post.id },
                data: { likes_count: { increment: 1 } },
            }),
        ])

        if (post.userId !== userId) {
            await prisma.notification.create({
                data: {
                    type: NotificationType.LIKE,
                    title: notificationTitle,
                    redirect_url: redirectPath,
                    userId: post.userId,
                    postId: post.id,
                },
            });

            const pushTokens = await prisma.pushToken.findMany({
                where: { userId: post.userId },
            });
            enqueuePushNotifications(pushTokens, notificationTitle, notificationBody, {
                type: NotificationType.LIKE,
                entity: "post",
                postPublicId: post.publicId,
                actorPublicId: req.user?.publicId ?? "",
                actorName: user.name ?? "",
            });
        }

        return res.status(201).json(successResponse(undefined, "Liked post"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const unlikePost = async (req: IAuthRequestBody<ILikePostBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const { publicId } = req.body;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!publicId) return res.status(400).json(errorResponse("Post public ID is required"));

        const post = await prisma.post.findUnique({
            where: { publicId: publicId as string },
            select: { id: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));

        await prisma.$transaction(async (tx) => {
            const deleted = await tx.postLike.deleteMany({
                where: { postId: post.id, userId },
            });
            if (deleted.count > 0) {
                await tx.post.update({
                    where: { id: post.id },
                    data: { likes_count: { decrement: 1 } },
                });
            }
        });

        res.status(200).json(successResponse(undefined, "Unliked post"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const getPost = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

        const publicId = getRouteParam(req, "publicId");
        if (!publicId) return res.status(400).json(errorResponse("Post public ID is required"));

        const post = await prisma.post.findUnique({
            where: { publicId: publicId as string },
            include: { media: true, user: true, community: true },
        });

        if (!post) return res.status(404).json(errorResponse("Post not found"));

        const isLiked = await prisma.postLike.findUnique({
            where: { postId_userId: { postId: post.id, userId } },
        });

        res.status(200).json(successResponse({ ...post, isLiked: !!isLiked }));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const updatePost = async (req: IAuthRequestBody<IUpdatePostBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const publicId = getRouteParam(req, "publicId");
        const { content, media } = req.body;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!publicId) return res.status(400).json(errorResponse("Post public ID is required"));

        const post = await prisma.post.findUnique({
            where: { publicId: publicId as string },
            select: { id: true, userId: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));
        if (post.userId !== userId) return res.status(403).json(errorResponse("Forbidden"));

        await prisma.post.update({
            where: { id: post.id },
            data: { content, media: { deleteMany: {}, create: media.map(url => ({ media_url: url })) } },
        });

        return res.status(200).json(successResponse(undefined, "Post updated"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const deletePost = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const publicId = getRouteParam(req, "publicId");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!publicId) return res.status(400).json(errorResponse("Post public ID is required"));

        const post = await prisma.post.findUnique({
            where: { publicId: publicId as string },
            select: { id: true, userId: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));
        if (post.userId !== userId) return res.status(403).json(errorResponse("Forbidden"));

        await prisma.post.update({
            where: { id: post.id },
            data: { is_deleted: true },
        });
        
        return res.status(200).json(successResponse(undefined, "Post deleted"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};