import express from 'express';
import {
  sendMessage,
  getConversation,
  getUserConversations,
  updateMessage,
  deleteMessage,
  markMessageAsRead,
  getUserPresence,    // <<< Ajoutez cette importation
  updateUserPresence, // <<< Optionnel
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
// Nouvelle route pour la présence
router.get('/users/:userId/presence', getUserPresence);
router.put('/users/presence', updateUserPresence); // Optionnel

export default router;