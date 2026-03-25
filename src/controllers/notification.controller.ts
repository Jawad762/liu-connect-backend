import { Response } from "express";
import { prisma } from "../lib/prisma.ts";
import { errorResponse, IAuthRequest, successResponse } from "../dtos/base.dto.ts";
import logger from "../lib/logger.ts";
import { parsePagination } from "../utils/pagination.utils.ts";

export const listNotifications = async (req: IAuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

    const { skip, take } = parsePagination(req.query.page, req.query.size, {
      defaultPage: 1,
      defaultSize: 20,
      maxSize: 50,
    });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
    });

    return res.status(200).json(successResponse(notifications));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

export const markAllNotificationsRead = async (req: IAuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return res.status(200).json(successResponse(undefined, "All notifications marked as read"));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};

