
// src/routes/notificationRoutes.ts
import express from 'express';
import {
  createNotification,
  getNotifications,
  getNotificationById,
  markAsRead,
  deleteNotification,
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/authMiddleware';
import { AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// === DEBUG : Vérifie que les handlers existent ===
console.log('Handlers loaded:', {
  getNotifications: typeof getNotifications,
  authenticateToken: typeof authenticateToken,
});

// === ROUTES PROTÉGÉES ===
router.get('/', authenticateToken, getNotifications);
router.get('/:id', authenticateToken, getNotificationById);
router.patch('/:id/read', authenticateToken, markAsRead);
router.delete('/:id', authenticateToken, deleteNotification);

// === CRÉATION (peut être publique ou admin) ===
router.post('/', createNotification); // ou: authenticateToken, createNotification

export default router;