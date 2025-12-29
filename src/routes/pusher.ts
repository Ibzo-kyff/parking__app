import express from 'express';
import { pusherAuth } from '../controllers/pusherController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/auth/pusher', authenticateToken, pusherAuth);

export default router;
