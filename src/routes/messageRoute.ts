// src/routes/message.routes.ts
import express from 'express';
import {
  sendMessage,
  getConversation,
  getUserConversations,
  deleteMessage,
} from '../controllers/messageController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// toutes les routes sont protégées
router.use(authenticateToken);

// Envoyer un message
router.post('/', sendMessage);

// Récupérer une conversation avec un utilisateur
router.get('/conversation/:userId', getConversation);

// Récupérer toutes les conversations de l’utilisateur connecté
router.get('/conversations', getUserConversations);

// Supprimer un message
router.delete('/:id', deleteMessage);

export default router;