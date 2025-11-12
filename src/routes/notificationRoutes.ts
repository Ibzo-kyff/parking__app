import express from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  createNotification,
  getNotifications,
  markAsRead,
  deleteNotification,
} from "../controllers/notificationController";

const router = express.Router();

router.post("/", authenticateToken, createNotification);
router.get("/", authenticateToken, getNotifications);
router.patch("/:id/read", authenticateToken, markAsRead);
router.delete("/:id", authenticateToken, deleteNotification);

export default router;