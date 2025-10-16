import express from 'express';
import {
  sendMessage,
  getConversation,
  getUserConversations,
  updateMessage,
  deleteMessage,
  markMessageAsRead,
} from '../controllers/messageController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

router.post('/', sendMessage);
router.get('/conversation/:userId', getConversation);
router.get('/conversations', getUserConversations);
router.put('/:id', updateMessage);
router.delete('/:id', deleteMessage);
router.patch('/:id/read', markMessageAsRead);

export default router;