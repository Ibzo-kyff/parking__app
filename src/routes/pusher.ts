import express from 'express';
import { pusherAuth, registerPushToken } from '../controllers/pusherController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/auth/pusher', authenticateToken, pusherAuth);
router.post('/auth/push-token', authenticateToken, registerPushToken);

export default router;
