import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { pusher } from '../index'; // Importer Pusher

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number };
}

// ✅ Envoyer un message
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    const { receiverId, content, parkingId } = req.body;

    if (!senderId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }
    if (!receiverId || !content) {
      return res.status(400).json({ message: 'receiverId et content sont obligatoires' });
    }

    // Vérifier les rôles (client-parking)
    const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { role: true } });
    const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { role: true } });
    if (sender?.role === receiver?.role) {
      return res.status(403).json({ message: 'Les messages doivent être entre un client et un parking' });
    }

    // Vérifier si parkingId est valide (si fourni)
    if (parkingId) {
      const parkingExists = await prisma.parking.findUnique({ where: { id: parkingId } });
      if (!parkingExists) {
        return res.status(404).json({ message: 'Parking introuvable' });
      }
    }

    const message = await prisma.message.create({
      data: { senderId, receiverId, content, parkingId },
      include: { sender: true, receiver: true, parking: true },
    });

    // 🔔 Notification en temps réel avec Pusher
    await pusher.trigger(`user_${receiverId}`, 'newMessage', message);
    await pusher.trigger(`user_${senderId}`, 'newMessage', message);

    // Créer une notification pour le destinataire
    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: `Nouveau message de ${message.sender.nom} ${message.sender.prenom}`,
        message: content.substring(0, 100),
        type: 'MESSAGE',
      },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Erreur sendMessage:', error);
    res.status(500).json({ message: 'Erreur lors de l’envoi du message', error });
  }
};

// ✅ Récupérer la conversation entre l’utilisateur connecté et un autre utilisateur
export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const otherUserId = parseInt(req.params.userId);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
        deletedAt: null, // Exclure les messages supprimés
      },
      orderBy: { createdAt: 'asc' },
      include: { sender: true, receiver: true, parking: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalMessages = await prisma.message.count({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
        deletedAt: null,
      },
    });

    res.json({
      messages,
      totalPages: Math.ceil(totalMessages / pageSize),
      currentPage: page,
    });
  } catch (error) {
    console.error('Erreur getConversation:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation', error });
  }
};

// Récupérer toutes les conversations (groupées par utilisateur)
export const getUserConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    // Récupérer le dernier message de chaque conversation
    const conversations = await prisma.message.groupBy({
      by: ['senderId', 'receiverId'],
      where: { OR: [{ senderId: userId }, { receiverId: userId }], deletedAt: null },
      _max: { createdAt: true },
    });

    // Filtrer les conversations avec createdAt non null et mapper
    const latestMessages = await prisma.message.findMany({
      where: {
        OR: conversations
          .filter((conv) => conv._max.createdAt !== null) // Exclure les createdAt null
          .map((conv) => ({
            senderId: conv.senderId,
            receiverId: conv.receiverId,
            createdAt: conv._max.createdAt!, // TypeScript sait que createdAt n'est pas null
            deletedAt: null,
          })),
      },
      include: { sender: true, receiver: true, parking: true },
      orderBy: { createdAt: 'desc' },
    });

    // Regroupement par "autre utilisateur"
    const conversationsMap: Record<number, any[]> = {};
    latestMessages.forEach((msg) => {
      const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversationsMap[otherUserId]) {
        conversationsMap[otherUserId] = [];
      }
      conversationsMap[otherUserId].push(msg);
    });

    res.json(conversationsMap);
  } catch (error) {
    console.error('Erreur getUserConversations:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations', error });
  }
};

// ✅ Mettre à jour un message
export const updateMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const messageId = parseInt(req.params.id);
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ message: 'Le contenu du message est obligatoire' });
    }

    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) {
      return res.status(404).json({ message: 'Message introuvable' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres messages' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { content },
      include: { sender: true, receiver: true, parking: true },
    });

    // 🔔 Notifier les deux utilisateurs de la mise à jour
    await pusher.trigger(`user_${message.receiverId}`, 'updateMessage', updatedMessage);
    await pusher.trigger(`user_${message.senderId}`, 'updateMessage', updatedMessage);

    res.json(updatedMessage);
  } catch (error) {
    console.error('Erreur updateMessage:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du message', error });
  }
};

// ✅ Supprimer un message (soft delete)
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

    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      include: { sender: true, receiver: true, parking: true },
    });

    // 🔔 Notifier suppression aux deux utilisateurs
    await pusher.trigger(`user_${message.receiverId}`, 'deleteMessage', messageId);
    await pusher.trigger(`user_${message.senderId}`, 'deleteMessage', messageId);

    res.json({ message: 'Message supprimé avec succès' });
  } catch (error) {
    console.error('Erreur deleteMessage:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du message', error });
  }
};

// ✅ Marquer un message comme lu
export const markMessageAsRead = async (req: AuthRequest, res: Response) => {
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

    if (message.receiverId !== userId) {
      return res.status(403).json({ message: 'Vous ne pouvez marquer que vos messages reçus comme lus' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { read: true },
      include: { sender: true, receiver: true, parking: true },
    });

    // 🔔 Notifier les deux utilisateurs
    await pusher.trigger(`user_${message.senderId}`, 'messageRead', updatedMessage);
    await pusher.trigger(`user_${message.receiverId}`, 'messageRead', updatedMessage);

    res.json(updatedMessage);
  } catch (error) {
    console.error('Erreur markMessageAsRead:', error);
    res.status(500).json({ message: 'Erreur lors du marquage du message comme lu', error });
  }
};