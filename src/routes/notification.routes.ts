import express from "express";
import {
  listNotifications,
  markAllNotificationsRead,
} from "../controllers/notification.controller.ts";
import { authMiddleware } from "../middleware/auth.middleware.ts";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listNotifications);
router.post("/read-all", markAllNotificationsRead);

export default router;

