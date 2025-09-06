import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { io } from '../index'; // ⚡ import de socket.io

const prisma = new PrismaClient();

// Typage pour req.user (injecté par authMiddleware)
interface AuthRequest extends Request {
  user?: { id: number };
}

// ✅ Envoyer un message
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    const { receiverId, content } = req.body;

    if (!senderId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }
    if (!receiverId || !content) {
      return res.status(400).json({ message: 'receiverId et content sont obligatoires' });
    }

    const message = await prisma.message.create({
      data: { senderId, receiverId, content },
      include: { sender: true, receiver: true },
    });

    // 🔔 Notification en temps réel
    io.to(`user_${receiverId}`).emit("newMessage", message);
    io.to(`user_${senderId}`).emit("newMessage", message);

    res.status(201).json(message);
  } catch (error) {
    console.error("Erreur sendMessage:", error);
    res.status(500).json({ message: 'Erreur lors de l’envoi du message', error });
  }
};

// ✅ Récupérer la conversation entre l’utilisateur connecté et un autre utilisateur
export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const otherUserId = parseInt(req.params.userId);

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { sender: true, receiver: true },
    });

    res.json(messages);
  } catch (error) {
    console.error("Erreur getConversation:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation', error });
  }
};

// ✅ Récupérer toutes les conversations (groupées par utilisateur)
export const getUserConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: { sender: true, receiver: true },
    });

    // 🔄 Regroupement par "autre utilisateur"
    const conversations: Record<number, any[]> = {};
    messages.forEach((msg) => {
      const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversations[otherUserId]) {
        conversations[otherUserId] = [];
      }
      conversations[otherUserId].push(msg);
    });

    res.json(conversations);
  } catch (error) {
    console.error("Erreur getUserConversations:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations', error });
  }
};

// ✅ Supprimer un message
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const messageId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) {
      return res.status(404).json({ message: 'Message introuvable' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres messages' });
    }

    await prisma.message.delete({ where: { id: messageId } });

    // 🔔 Notifier suppression aux deux utilisateurs
    io.to(`user_${message.receiverId}`).emit("deleteMessage", messageId);
    io.to(`user_${message.senderId}`).emit("deleteMessage", messageId);

    res.json({ message: 'Message supprimé avec succès' });
  } catch (error) {
    console.error("Erreur deleteMessage:", error);
    res.status(500).json({ message: 'Erreur lors de la suppression du message', error });
  }
};
