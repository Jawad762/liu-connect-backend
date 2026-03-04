import { IAuthRequestBody, IAuthRequest } from "../dtos/base.dto.ts";
import { errorResponse, successResponse } from "../dtos/base.dto.ts";
import { IAddPushTokenBody, IUpdateProfileBody, IUserListItem } from "../dtos/user.dto.ts";
import { prisma } from "../lib/prisma.ts";
import { Response } from "express";
import { toProfile, toProfileSelf, toUserListItem } from "../mappers/user.mapper.ts";
import { validateName } from "../utils/auth.utils.ts";
import { getRouteParam } from "../utils/request.utils.ts";
import { NotificationType } from "../../generated/prisma/enums.ts";
import { enqueuePushNotifications } from "../queue/enqueuePushNotifications.ts";
import logger from "../lib/logger.ts";

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

    const { name, avatar_url, bio } = req.body;
    if (!validateName(name)) return res.status(400).json(errorResponse("Name must be at least 2 characters"));

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, avatar_url, bio },
    });
    res.status(200).json(successResponse(toProfileSelf(user)));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const getUserByPublicId = async (req: IAuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json(errorResponse("Unauthorized"));

    const publicId = getRouteParam(req, "publicId");
    if (!publicId) return res.status(400).json(errorResponse("Invalid user"));

    const user = await prisma.user.findUnique({
      where: { publicId },
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

    const publicId = getRouteParam(req, "publicId");
    if (!publicId) return res.status(400).json(errorResponse("Invalid user"));

    const targetUser = await prisma.user.findUnique({
      where: { publicId },
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
    const redirectPath = req.user.publicId ? `/users/${req.user.publicId}` : undefined;

    await prisma.notification.create({
      data: {
        type: NotificationType.FOLLOW,
        title: notificationTitle,
        ...(redirectPath && { redirect_url: redirectPath }),
        userId: targetUser.id,
      },
    });

    const pushTokens = await prisma.pushToken.findMany({
      where: { userId: targetUser.id },
    });
    enqueuePushNotifications(pushTokens, notificationTitle, notificationBody, {
      type: NotificationType.FOLLOW,
      entity: "user",
      followerPublicId: req.user.publicId ?? "",
      actorPublicId: req.user.publicId ?? "",
      actorName: req.user.name ?? "",
    });

    res.status(201).json(successResponse(undefined, "Following"));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const unfollowUser = async (req: IAuthRequest, res: Response) => {
  try {
    const followerId = req.user?.id;
    if (!followerId) return res.status(401).json(errorResponse("Unauthorized"));

    const publicId = getRouteParam(req, "publicId");
    if (!publicId) return res.status(400).json(errorResponse("Invalid user"));

    const targetUser = await prisma.user.findUnique({
      where: { publicId },
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
    res.status(200).json(successResponse(undefined, "Unfollowed"));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const getFollowers = async (req: IAuthRequest, res: Response) => {
  try {
    const publicId = getRouteParam(req, "publicId");
    if (!publicId) return res.status(400).json(errorResponse("Invalid user"));

    const { page = 1, size = 10 } = req.query;

    const user = await prisma.user.findUnique({
      where: { publicId },
    });
    if (!user || user.is_deleted) return res.status(404).json(errorResponse("User not found"));

    const follows = await prisma.userFollow.findMany({
      where: { followingId: user.id },
      include: { follower: { select: { publicId: true, name: true, avatar_url: true, bio: true, school: true, major: true } } },
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(size),
      take: Number(size),
    });

    const list: IUserListItem[] = follows.map((f) => toUserListItem(f.follower));
    res.status(200).json(successResponse(list));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const getFollowing = async (req: IAuthRequest, res: Response) => {
  try {
    const publicId = getRouteParam(req, "publicId");
    if (!publicId) return res.status(400).json(errorResponse("Invalid user"));

    const { page = 1, size = 10 } = req.query;

    const user = await prisma.user.findUnique({
      where: { publicId },
    });
    if (!user || user.is_deleted) return res.status(404).json(errorResponse("User not found"));

    const follows = await prisma.userFollow.findMany({
      where: { followerId: user.id },
      include: { following: { select: { publicId: true, name: true, avatar_url: true, bio: true, school: true, major: true } } },
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(size),
      take: Number(size),
    });

    const list: IUserListItem[] = follows.map((f) => toUserListItem(f.following));
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

    await prisma.pushToken.create({
      data: { token, userId },
    });

    return res.status(201).json(successResponse(undefined, "Push token added"));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};