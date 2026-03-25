import { IAuthRequestBody, IAuthRequest } from "../dtos/base.dto.ts";
import { errorResponse, successResponse } from "../dtos/base.dto.ts";
import { IAddPushTokenBody, IDeleteMyAccountBody, IUpdateProfileBody, IUserListItem } from "../dtos/user.dto.ts";
import { prisma } from "../lib/prisma.ts";
import { Response } from "express";
import { toProfile, toProfileSelf } from "../mappers/user.mapper.ts";
import { validateBio, validateMajor, validateName, validateSchool } from "../utils/user.utils.ts";
import { getRouteParam } from "../utils/request.utils.ts";
import { NotificationType } from "../../generated/prisma/enums.ts";
import { enqueuePushNotifications } from "../queue/enqueuePushNotifications.ts";
import logger from "../lib/logger.ts";
import bcrypt from "bcrypt";
import { validateUrl } from "../utils/media.utils.ts";

export const getMe = async (req: IAuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.is_deleted) return res.status(404).json(errorResponse("User not found"));

    res.status(200).json(successResponse(toProfileSelf(user)));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const updateProfile = async (req: IAuthRequestBody<IUpdateProfileBody>, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

    const { name, avatar_url, cover_url, bio, major, school } = req.body;

    const nameValidation = validateName(name);
    if (!nameValidation.success) return res.status(400).json(errorResponse(nameValidation.message));

    const bioValidation = validateBio(bio);
    if (!bioValidation.success) return res.status(400).json(errorResponse(bioValidation.message));

    if (school) {
      const schoolValidation = validateSchool(school);
      if (!schoolValidation.success) return res.status(400).json(errorResponse(schoolValidation.message));
    }

    if (major) {
      const majorValidation = validateMajor(major);
      if (!majorValidation.success) return res.status(400).json(errorResponse(majorValidation.message));
    }

    if (avatar_url) {
      const avatarUrlValidation = validateUrl(avatar_url);
      if (!avatarUrlValidation.success) return res.status(400).json(errorResponse(avatarUrlValidation.message));
    }

    if (cover_url) {
      const coverUrlValidation = validateUrl(cover_url);
      if (!coverUrlValidation.success) return res.status(400).json(errorResponse(coverUrlValidation.message));
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, avatar_url, cover_url, bio, major, school },
    });
    res.status(200).json(successResponse(toProfileSelf(user)));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const getUserById = async (req: IAuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json(errorResponse("Unauthorized"));

    const id = getRouteParam(req, "id");
    if (!id) return res.status(400).json(errorResponse("Invalid user"));

    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user || user.is_deleted) return res.status(404).json(errorResponse("User not found"));

    const isFollowing = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: { followerId: currentUserId, followingId: user.id },
      },
    });

    res.status(200).json(successResponse(toProfile(user, !!isFollowing)));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const followUser = async (req: IAuthRequest, res: Response) => {
  try {
    const followerId = req.user.id;
    if (!followerId) return res.status(401).json(errorResponse("Unauthorized"));

    const id = getRouteParam(req, "id");
    if (!id) return res.status(400).json(errorResponse("Invalid user"));

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });
    if (!targetUser || targetUser.is_deleted) return res.status(404).json(errorResponse("User not found"));
    if (targetUser.id === followerId) return res.status(400).json(errorResponse("Cannot follow yourself"));

    await prisma.$transaction([
      prisma.userFollow.create({
        data: { followerId, followingId: targetUser.id },
      }),
      prisma.user.update({
        where: { id: targetUser.id },
        data: { followers_count: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: followerId },
        data: { following_count: { increment: 1 } },
      }),
    ]);

    const notificationTitle = `${req.user.name ?? "Someone"} followed you`;
    const notificationBody = "You have a new follower";
    const redirectPath = req.user.id ? `/user/${req.user.id}/profile` : undefined;

    await prisma.notification.create({
      data: {
        type: NotificationType.FOLLOW,
        title: notificationTitle,
        body: notificationBody,
        ...(redirectPath && { redirect_url: redirectPath }),
        userId: targetUser.id,
        actorId: followerId,
      },
    });

    const targetUserWithPushToken = await prisma.user.findUnique({
      where: { id: targetUser.id },
      select: { push_token: true },
    });
    const pushTokens = targetUserWithPushToken?.push_token ? [targetUserWithPushToken.push_token] : [];
    
    enqueuePushNotifications(pushTokens, notificationTitle, notificationBody, {
      type: "user_followed",
      redirectPath: redirectPath ?? "",
      followerId: req.user.id ?? "",
      actorId: req.user.id ?? "",
      actorName: req.user.name ?? "Someone",
    });

    const requestUser = await prisma.user.findUnique({
      where: { id: followerId },
      select: { following_count: true, followers_count: true },
    });

    if (!requestUser) return res.status(404).json(errorResponse("User not found"));

    const response = {
      following_count: requestUser.following_count,
      followers_count: requestUser.followers_count,
    }

    res.status(201).json(successResponse(response, "Following"));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const unfollowUser = async (req: IAuthRequest, res: Response) => {
  try {
    const followerId = req.user?.id;
    if (!followerId) return res.status(401).json(errorResponse("Unauthorized"));

    const id = getRouteParam(req, "id");
    if (!id) return res.status(400).json(errorResponse("Invalid user"));

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });
    if (!targetUser || targetUser.is_deleted) return res.status(404).json(errorResponse("User not found"));

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.userFollow.deleteMany({
        where: { followerId, followingId: targetUser.id },
      });
      if (deleted.count > 0) {
        await tx.user.update({
          where: { id: targetUser.id },
          data: { followers_count: { decrement: 1 } },
        });
        await tx.user.update({
          where: { id: followerId },
          data: { following_count: { decrement: 1 } },
        });
      }
    });

    const requestUser = await prisma.user.findUnique({
      where: { id: followerId },
      select: { following_count: true, followers_count: true },
    });

    if (!requestUser) return res.status(404).json(errorResponse("User not found"));

    const response = {
      following_count: requestUser.following_count,
      followers_count: requestUser.followers_count,
    }

    res.status(200).json(successResponse(response, "Unfollowed"));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const getFollowers = async (req: IAuthRequest, res: Response) => {
  try {
    const id = getRouteParam(req, "id");
    if (!id) return res.status(400).json(errorResponse("Invalid user"));

    const { page = 1, size = 10 } = req.query;

    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user || user.is_deleted) return res.status(404).json(errorResponse("User not found"));

    const follows = await prisma.userFollow.findMany({
      where: { followingId: user.id },
      include: { follower: { select: { id: true, name: true, avatar_url: true, cover_url: true, bio: true, school: true, major: true } } },
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(size),
      take: Number(size),
    });

    const list = follows.map((f) => f.follower);
    res.status(200).json(successResponse(list));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const getFollowing = async (req: IAuthRequest, res: Response) => {
  try {
    const id = getRouteParam(req, "id");
    if (!id) return res.status(400).json(errorResponse("Invalid user"));

    const { page = 1, size = 10 } = req.query;

    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user || user.is_deleted) return res.status(404).json(errorResponse("User not found"));

    const follows = await prisma.userFollow.findMany({
      where: { followerId: user.id },
      include: { following: { select: { id: true, name: true, avatar_url: true, bio: true, cover_url: true, school: true, major: true } } },
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(size),
      take: Number(size),
    });

    const list = follows.map((f) => f.following);
    res.status(200).json(successResponse(list));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const addPushToken = async (req: IAuthRequestBody<IAddPushTokenBody>, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

    const { token } = req.body;
    if (!token) return res.status(400).json(errorResponse("Token is required"));
    const normalizedToken = token.trim();
    if (!normalizedToken) return res.status(400).json(errorResponse("Token is required"));

    await prisma.user.update({
      where: { id: userId },
      data: { push_token: normalizedToken },
    });

    return res.status(201).json(successResponse(undefined, "Push token added"));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const search = async (req: IAuthRequest, res: Response) => {
  try {
    const { query, page = 1, size = 10 } = req.query;
    const pageNumber = Math.max(1, parseInt(page as string) || 1);
    const sizeNumber = Math.min(30, Math.max(1, parseInt(size as string) || 20));
    const sanitizedQuery = typeof query === "string" ? query.trim().toLowerCase() : null;
    if (!sanitizedQuery) return res.status(400).json(errorResponse("Query is required"));

    const users = await prisma.user.findMany({
      where: {
        is_deleted: false,
        name: { contains: sanitizedQuery, mode: "insensitive" },
      },
      skip: (pageNumber - 1) * sizeNumber,
      take: sizeNumber,
    })

    return res.status(200).json(successResponse(users.map((user) => toProfile(user, false))));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const deleteMyAccount = async (req: IAuthRequestBody<IDeleteMyAccountBody>, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json(errorResponse("Password is required"));

    const userId = req.user?.id;
    if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.is_deleted) return res.status(404).json(errorResponse("User not found"));
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json(errorResponse("Invalid password"));

    await prisma.user.update({
      where: { id: userId },
      data: { is_deleted: true, deleted_at: new Date(), refresh_token: null, push_token: null },
    });

    return res.status(200).json(successResponse(undefined, "Account deleted"));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};