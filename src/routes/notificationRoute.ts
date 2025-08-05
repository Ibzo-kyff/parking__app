import express from 'express';
import {
  createNotification,
  getNotifications,
  getNotificationById,
  markAsRead,
  deleteNotification
} from '../controllers/notificationContoller';

const router = express.Router();

// Routes pour les notifications
router.post('/', createNotification);
router.get('/', getNotifications);
router.get('/:id', getNotificationById);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;