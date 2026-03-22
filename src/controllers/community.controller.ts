import { errorResponse, IAuthRequest, IAuthRequestBody, successResponse } from "../dtos/base.dto.ts";
import { Response } from "express";
import { prisma } from "../lib/prisma.ts";
import { ICreateCommunityBody, IUpdateCommunityBody } from "../dtos/community.dto.ts";
import { getRouteParam } from "../utils/request.utils.ts";
import logger from "../lib/logger.ts";
import { validateBio, validateName } from "../utils/user.utils.ts";

export const getCommunities = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

        const { page: rawPage, size: rawSize, search = "", userOnly: rawUserOnly } = req.query;

        const page = Math.max(1, parseInt(rawPage as string) || 1);
        const size = Math.min(100, Math.max(1, parseInt(rawSize as string) || 10));

        const cleanedSearch = typeof search === "string" ? search.trim().toLowerCase() : null;
        const userOnly = rawUserOnly === "true";

        const communities = await prisma.community.findMany({
            where: {
                ...(cleanedSearch && {
                    name: { contains: cleanedSearch, mode: "insensitive" },
                }),
                ...(userOnly && {
                    OR: [
                        { communityMembers: { some: { userId } } },
                        { createdById: userId },
                    ]
                }),
            },
            orderBy: {
                createdAt: "desc",
            },
            skip: (page - 1) * size,
            take: size,
            include: {
                communityMembers: {
                    where: { userId },
                    select: { id: true },
                    take: 1,
                },
            },
        });

        const mappedCommunities = communities.map(({ communityMembers, ...c }) => ({
            ...c,
            isJoined: communityMembers.length > 0,
        }));

        return res.status(200).json(successResponse(mappedCommunities));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const createCommunity = async (
    req: IAuthRequestBody<ICreateCommunityBody>,
    res: Response
) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

        const { name, description, avatar_url } = req.body;

        const nameValidation = validateName(name);
        if (!nameValidation.success) {
            return res
                .status(400)
                .json(errorResponse(nameValidation.message));
        }
        const descriptionValidation = validateBio(description ?? null);
        if (!descriptionValidation.success) {
            return res
                .status(400)
                .json(errorResponse(descriptionValidation.message));
        }

        const community = await prisma.community.create({
            data: {
                name,
                description: description ?? null,
                createdById: userId,
                avatar_url: avatar_url ?? null,
            },
        });

        return res.status(201).json(successResponse(community));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const getCommunity = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

        const id = getRouteParam(req, "id");
        if (!id) {
            return res
                .status(400)
                .json(errorResponse("Community ID is required"));
        }

        const community = await prisma.community.findUnique({
            where: { id },
        });

        if (!community) {
            return res.status(404).json(errorResponse("Community not found"));
        }

        const communityMember = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId: id, userId } },
        });

        return res.status(200).json(successResponse({ ...community, isJoined: !!communityMember }));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const updateCommunity = async (
    req: IAuthRequestBody<IUpdateCommunityBody>,
    res: Response
) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

        const id = getRouteParam(req, "id");
        if (!id) {
            return res
                .status(400)
                .json(errorResponse("Community ID is required"));
        }

        const existing = await prisma.community.findUnique({
            where: { id },
            select: { id: true, createdById: true },
        });

        if (!existing) {
            return res.status(404).json(errorResponse("Community not found"));
        }

        if (existing.createdById !== userId) {
            return res.status(403).json(errorResponse("Forbidden"));
        }

        const { name, description, avatar_url } = req.body;

        const nameValidation = validateName(name ?? null);
        if (!nameValidation.success) {
            return res
                .status(400)
                .json(errorResponse(nameValidation.message));
        }

        const descriptionValidation = validateBio(description ?? null);
        if (!descriptionValidation.success) {
            return res
                .status(400)
                .json(errorResponse(descriptionValidation.message));
        }

        await prisma.community.update({
            where: { id: existing.id },
            data: {
                name: name as string,
                description: description ?? null,
                avatar_url: avatar_url ?? null,
            },
        });

        return res.status(200).json(successResponse(undefined, "Community updated"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const deleteCommunity = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

        const id = getRouteParam(req, "id");
        if (!id) {
            return res
                .status(400)
                .json(errorResponse("Community ID is required"));
        }

        const existing = await prisma.community.findUnique({
            where: { id },
            select: { id: true, createdById: true },
        });

        if (!existing) {
            return res.status(404).json(errorResponse("Community not found"));
        }

        if (existing.createdById !== userId) {
            return res.status(403).json(errorResponse("Forbidden"));
        }

        const postsCount = await prisma.post.count({
            where: {
                communityId: existing.id,
                is_deleted: false,
            },
        });

        if (postsCount > 0) {
            return res
                .status(400)
                .json(errorResponse("Cannot delete community with posts"));
        }

        await prisma.community.delete({
            where: { id: existing.id },
        });

        return res.status(200).json(successResponse(undefined, "Community deleted"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const joinCommunity = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

        const id = getRouteParam(req, "id");
        if (!id) {
            return res
                .status(400)
                .json(errorResponse("Community ID is required"));
        }

        const community = await prisma.community.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!community) {
            return res.status(404).json(errorResponse("Community not found"));
        }

        await prisma.communityMember.upsert({
            where: {
                communityId_userId: {
                    communityId: community.id,
                    userId,
                },
            },
            update: {},
            create: {
                communityId: community.id,
                userId,
            },
        });

        return res.status(201).json(successResponse(undefined, "Joined community"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};

export const leaveCommunity = async (req: IAuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

        const id = getRouteParam(req, "id");
        if (!id) {
            return res
                .status(400)
                .json(errorResponse("Community ID is required"));
        }

        const community = await prisma.community.findUnique({
            where: { id },
            select: { id: true, createdById: true },
        });

        if (!community) {
            return res.status(404).json(errorResponse("Community not found"));
        }

        if (community.createdById === userId) {
            return res
                .status(400)
                .json(errorResponse("Community owner cannot leave their own community"));
        }

        await prisma.communityMember.deleteMany({
            where: {
                communityId: community.id,
                userId,
            },
        });

        return res.status(200).json(successResponse(undefined, "Left community"));
    } catch (error) {
        logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
        return res.status(500).json(errorResponse("Internal server error"));
    }
};
