import { errorResponse, IAuthRequest, IAuthRequestBody, successResponse } from "../dtos/base.dto.ts";
import { ICreatePostBody, ILikePostBody, IUpdatePostBody } from "../dtos/post.dto.ts";
import { prisma } from "../lib/prisma.ts";
import { Response } from "express";
import { validatePost } from "../utils/post.utils.ts";
import { getRouteParam } from "../utils/request.utils.ts";
import { NotificationType } from "../../generated/prisma/enums.ts";
import { enqueuePushNotifications } from "../queue/enqueuePushNotifications.ts";
import logger from "../lib/logger.ts";

export const getPosts = async (req: IAuthRequest, res: Response) => {
    try {
        const currentUserId = req.user?.id;
        if (!currentUserId) return res.status(401).json(errorResponse("Unauthorized"));

        const { page: rawPage, size: rawSize, followingOnly: rawFollowingOnly, communityPublicId, authorPublicId } = req.query;

        const pageNumber = Math.max(1, Number(rawPage));
        const sizeNumber = Math.min(30, Math.max(1, Number(rawSize)));
        const followingOnly = rawFollowingOnly === "true";

        if (followingOnly && communityPublicId) return res.status(400).json(errorResponse("Please either choose following only or a community, but not both."));
        if (followingOnly && authorPublicId) return res.status(400).json(errorResponse("Please either choose following only or an author, but not both."));
        
        let authorId = null;
        if (authorPublicId) {
            const author = await prisma.user.findUnique({
                where: { publicId: authorPublicId as string },
                select: { id: true },
            });
            if (!author) return res.status(404).json(errorResponse("User not found"));
            authorId = author.id;
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

        const userFollowings = followingOnly ? await prisma.userFollow.findMany({
            where: { followerId: currentUserId },
            select: { followingId: true },
        }) : [];
        const followingIds = followingOnly ? userFollowings.map(uf => uf.followingId) : [];

        const posts = await prisma.post.findMany({
            where: {
                ...(communityId && { communityId }),
                ...(authorId != null && { userId: authorId }),
                ...(followingOnly && { userId: { in: followingIds } }),
                is_deleted: false,
            },
            orderBy: {
                createdAt: "desc",
            },
            skip: (pageNumber - 1) * sizeNumber,
            take: sizeNumber,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar_url: true,
                        publicId: true,
                        major: true,
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
                        publicId: true,
                        media_url: true,
                        type: true,
                    },
                }
            },
        });
        const postIds = posts.map((post) => post.id);

        const likes = postIds.length > 0
            ? await prisma.postLike.findMany({
                where: {
                    userId: currentUserId,
                    postId: { in: postIds },
                },
                select: { postId: true },
            })
            : [];

        const likedPostIds = new Set(likes.map((like) => like.postId));

        const postsWithIsLiked = posts.map((post) => ({
            ...post,
            isLiked: likedPostIds.has(post.id),
        }));
        res.status(200).json(successResponse(postsWithIsLiked));
    } catch (error) {
        logger.error(
            {
                err: error,
                method: req.method,
                path: req.path,
                userId: req.user?.id,
                query: req.query,
            },
            "Request failed"
        );
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const createPost = async (req: IAuthRequestBody<ICreatePostBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const { content, communityPublicId, media: rawMedia } = req.body;
        const media = rawMedia ?? [];
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        const postValidation = validatePost(content, media);
        if (!postValidation.success) return res.status(400).json(errorResponse(postValidation.message));

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
                media: { create: media.map((m) => ({ media_url: m.url, type: m.type })) },
            },
            include: { media: { select: { publicId: true, media_url: true, type: true } } },
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

        const existingLike = await prisma.postLike.findUnique({
            where: { postId_userId: { postId: post.id, userId } },
        });
        if (existingLike) {
            return res.status(200).json(successResponse(undefined, "Already liked"));
        }

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
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2002") {
            return res.status(200).json(successResponse(undefined, "Already liked"));
        }
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
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2002") {
            return res.status(200).json(successResponse(undefined, "Already unliked"));
        }
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
            include: {
                media: { select: { publicId: true, media_url: true, type: true } },
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar_url: true,
                        publicId: true,
                        major: true,
                    },
                },
                community: true,
            },
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
        const { content, media: rawMedia } = req.body;
        const media = rawMedia ?? [];
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!publicId) return res.status(400).json(errorResponse("Post public ID is required"));
        const postValidation = validatePost(content, media);
        if (!postValidation.success) return res.status(400).json(errorResponse(postValidation.message));

        const post = await prisma.post.findUnique({
            where: { publicId: publicId as string },
            select: { id: true, userId: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));
        if (post.userId !== userId) return res.status(403).json(errorResponse("Forbidden"));

        await prisma.post.update({
            where: { id: post.id },
            data: { content, media: { deleteMany: {}, create: media.map(m => ({ media_url: m.url, type: m.type })) } },
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