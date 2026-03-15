import { errorResponse, IAuthRequest, IAuthRequestBody, successResponse } from "../dtos/base.dto.ts";
import { ICreatePostBody, IUpdatePostBody } from "../dtos/post.dto.ts";
import { prisma } from "../lib/prisma.ts";
import { Response } from "express";
import { validatePost } from "../utils/post.utils.ts";
import { getRouteParam } from "../utils/request.utils.ts";
import { BookmarkableType, NotificationType } from "../../generated/prisma/enums.ts";
import { enqueuePushNotifications } from "../queue/enqueuePushNotifications.ts";
import logger from "../lib/logger.ts";

export const getPosts = async (req: IAuthRequest, res: Response) => {
    try {
        const currentUserId = req.user?.id;
        if (!currentUserId) return res.status(401).json(errorResponse("Unauthorized"));

        const { page: rawPage, size: rawSize, followingOnly: rawFollowingOnly, communityId: queryCommunityId, authorId: queryAuthorId } = req.query;

        const pageNumber = Math.max(1, parseInt(rawPage as string) || 1);
        const sizeNumber = Math.min(30, Math.max(1, parseInt(rawSize as string) || 20));
        const followingOnly = rawFollowingOnly === "true";

        if (followingOnly && queryCommunityId) return res.status(400).json(errorResponse("Please either choose following only or a community, but not both."));
        if (followingOnly && queryAuthorId) return res.status(400).json(errorResponse("Please either choose following only or an author, but not both."));
        
        const authorId = typeof queryAuthorId === "string" ? queryAuthorId : null;
        if (authorId) {
            const author = await prisma.user.findUnique({
                where: { id: authorId },
                select: { id: true },
            });
            if (!author) return res.status(404).json(errorResponse("User not found"));
        }

        const communityId = typeof queryCommunityId === "string" ? queryCommunityId : null;
        if (communityId) {
            const community = await prisma.community.findUnique({
                where: { id: communityId },
                select: { id: true },
            });
            if (!community) return res.status(404).json(errorResponse("Community not found"));
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
                        major: true,
                    },
                },
                community: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                media: {
                    select: {
                        id: true,
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

        const bookmarks = postIds.length > 0
            ? await prisma.bookmark.findMany({
                where: {
                    userId: currentUserId,
                    type: BookmarkableType.POST,
                    entityId: { in: postIds },
                },
                select: { entityId: true },
            })
            : [];
        const bookmarkedPostIds = new Set(bookmarks.map((bookmark) => bookmark.entityId));

        const postsWithIsLiked = posts.map((post) => ({
            ...post,
            isLiked: likedPostIds.has(post.id),
            isBookmarked: bookmarkedPostIds.has(post.id),
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
        const { content, communityId: bodyCommunityId, media: rawMedia } = req.body;
        const media = rawMedia ?? [];
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        const postValidation = validatePost(content, media);
        if (!postValidation.success) return res.status(400).json(errorResponse(postValidation.message));

        let communityId: string | null = null;
        if (bodyCommunityId) {
            const community = await prisma.community.findUnique({
                where: { id: bodyCommunityId },
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
            include: { media: { select: { id: true, media_url: true, type: true } } },
        });
        res.status(201).json(successResponse(post));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const likePost = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const postId = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!postId) return res.status(400).json(errorResponse("Post ID is required"));

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        if (!user) return res.status(404).json(errorResponse("User not found"));

        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true, userId: true },
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
        const redirectPath = `/posts/${post.id}`;

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
                postId: post.id,
                actorId: req.user?.id ?? "",
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

export const unlikePost = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const postId = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!postId) return res.status(400).json(errorResponse("Post ID is required"));

        const post = await prisma.post.findUnique({
            where: { id: postId },
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

        const id = getRouteParam(req, "id");
        if (!id) return res.status(400).json(errorResponse("Post ID is required"));

        const post = await prisma.post.findFirst({
            where: { id, is_deleted: false },
            include: {
                media: { select: { id: true, media_url: true, type: true } },
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar_url: true,
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
        const isBookmarked = await prisma.bookmark.findUnique({
            where: { userId_type_entityId: { userId, type: BookmarkableType.POST, entityId: post.id } },
        });

        res.status(200).json(successResponse({ ...post, isLiked: !!isLiked, isBookmarked: !!isBookmarked }));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const updatePost = async (req: IAuthRequestBody<IUpdatePostBody>, res: Response) => {
    try {
        const userId = req.user?.id;
        const id = getRouteParam(req, "id");
        const { content, media: rawMedia } = req.body;
        const media = rawMedia ?? [];
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!id) return res.status(400).json(errorResponse("Post ID is required"));
        const postValidation = validatePost(content, media);
        if (!postValidation.success) return res.status(400).json(errorResponse(postValidation.message));

        const post = await prisma.post.findFirst({
            where: { id, is_deleted: false },
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
        const id = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!id) return res.status(400).json(errorResponse("Post ID is required"));

        const post = await prisma.post.findUnique({
            where: { id },
            select: { id: true, userId: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));
        if (post.userId !== userId) return res.status(403).json(errorResponse("Forbidden"));

        await prisma.post.update({
            where: { id: post.id },
            data: { is_deleted: true, deleted_at: new Date() },
        });

        return res.status(200).json(successResponse(undefined, "Post deleted"));
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
            where: { userId, type: BookmarkableType.POST },
            orderBy: { createdAt: "desc" },
            skip: (pageNumber - 1) * sizeNumber,
            take: sizeNumber,
            select: { entityId: true },
        });

        const postIds = bookmarks.map((b) => b.entityId);
        if (postIds.length === 0) {
            return res.status(200).json(successResponse([]));
        }

        const posts = await prisma.post.findMany({
            where: { id: { in: postIds }, is_deleted: false },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar_url: true,
                        major: true,
                    },
                },
                community: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                media: {
                    select: {
                        id: true,
                        media_url: true,
                        type: true,
                    },
                },
            },
        });
        const postById = new Map(posts.map((p) => [p.id, p]));
        const postsInOrder = postIds.map((id) => postById.get(id)).filter(Boolean) as typeof posts;
        const likes = await prisma.postLike.findMany({
            where: { postId: { in: postsInOrder.map((p) => p.id) }, userId },
            select: { postId: true },
        });
        const likedPostIds = new Set(likes.map((l) => l.postId));
        const postsWithMeta = postsInOrder.map((post) => ({
            ...post,
            isLiked: likedPostIds.has(post.id),
            isBookmarked: true,
        }));

        return res.status(200).json(successResponse(postsWithMeta));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const bookmarkPost = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const postId = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!postId) return res.status(400).json(errorResponse("Post ID is required"));

        const post = await prisma.post.findFirst({
            where: { id: postId, is_deleted: false },
            select: { id: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));

        const existing = await prisma.bookmark.findUnique({
            where: { userId_type_entityId: { userId, type: BookmarkableType.POST, entityId: postId } },
        });
        if (existing) {
            return res.status(200).json(successResponse(undefined, "Already bookmarked"));
        }

        await prisma.bookmark.create({
            data: { userId, type: BookmarkableType.POST, entityId: postId },
        });
        return res.status(201).json(successResponse(undefined, "Bookmarked post"));
    } catch (error) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2002") return res.status(200).json(successResponse(undefined, "Already bookmarked"));
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const unbookmarkPost = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const postId = getRouteParam(req, "id");
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!postId) return res.status(400).json(errorResponse("Post ID is required"));

        const bookmark = await prisma.bookmark.findUnique({
            where: { userId_type_entityId: { userId, type: BookmarkableType.POST, entityId: postId } },
        });
        if (!bookmark) {
            return res.status(200).json(successResponse(undefined, "Not bookmarked"));
        }
        await prisma.bookmark.delete({ where: { id: bookmark.id } });
        return res.status(200).json(successResponse(undefined, "Unbookmarked post"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};