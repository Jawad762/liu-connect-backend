import { errorResponse, IAuthRequest, IAuthRequestBody, successResponse } from "../dtos/base.dto.ts";
import { ICreatePostBody, ILikePostBody } from "../dtos/posts.dto.ts";
import { prisma } from "../lib/prisma.ts";
import { Response } from "express";
import { validateContent } from "../utils/post.utils.ts";

export const getPosts = async (req: IAuthRequest, res: Response) => {
    try {
        const { page = 1, communityPublicId, publicUserId } = req.query;

        let userId = null;
        if (publicUserId) {
            const user = await prisma.user.findUnique({
                where: { publicId: publicUserId as string },
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
            skip: (Number(page) - 1) * 10,
            take: 10,
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
        res.status(200).json(successResponse(posts));
    } catch (error) {
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const createPost = async (req: IAuthRequestBody<ICreatePostBody>, res: Response) => {
    try {
        const userId = req.userId;
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
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const likePost = async (req: IAuthRequestBody<ILikePostBody>, res: Response) => {
    try {
        const userId = req.userId;
        const { postPublicId } = req.body;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!postPublicId) return res.status(400).json(errorResponse("Post public ID is required"));

        const post = await prisma.post.findUnique({
            where: { publicId: postPublicId as string },
            select: { id: true },
        });
        if (!post) return res.status(404).json(errorResponse("Post not found"));

        await prisma.$transaction([
            prisma.postLike.create({
                data: { postId: post.id, userId },
            }),
            prisma.post.update({
                where: { id: post.id },
                data: { likes_count: { increment: 1 } },
            }),
        ])

        res.status(201).json(successResponse(undefined, "Liked post"));
    } catch (error) {
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const unlikePost = async (req: IAuthRequestBody<ILikePostBody>, res: Response) => {
    try {
        const userId = req.userId;
        const { postPublicId } = req.body;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
        if (!postPublicId) return res.status(400).json(errorResponse("Post public ID is required"));

        const post = await prisma.post.findUnique({
            where: { publicId: postPublicId as string },
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
        return res.status(500).json(errorResponse("Internal server error"));
    }
};