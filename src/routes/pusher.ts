import express from 'express';
import { pusherAuth, pusherWebhook, registerPushToken } from '../controllers/pusherController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/auth/pusher', authenticateToken, pusherAuth);
router.post('/auth/push-token', authenticateToken, registerPushToken);
router.post('/pusher/webhook', pusherWebhook);
export default router;
