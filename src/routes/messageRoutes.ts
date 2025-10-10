// src/routes/message.routes.ts
import express from 'express';
import {
  sendMessage,
  getConversation,
  getUserConversations,
  deleteMessage,
  updateMessage,
  markMessagesAsRead,
  getUserConversation,
  getParkingConversation
} from '../controllers/messageController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Toutes les routes sont protégées
router.use(authenticateToken);

// Envoyer un message
router.post('/', sendMessage);

// Récupérer une conversation avec un utilisateur spécifique
router.get('/user/:userId', getConversation);

// Récupérer une conversation avec un parking spécifique
router.get('/parking/:parkingId', getParkingConversation);

// Récupérer toutes les conversations de l'utilisateur connecté
router.get('/conversations', getUserConversations);

// Mettre à jour un message
router.put('/:id', updateMessage);

// Supprimer un message
router.delete('/:id', deleteMessage);

// Marquer les messages comme lus
router.patch('/read', markMessagesAsRead);

export default router;