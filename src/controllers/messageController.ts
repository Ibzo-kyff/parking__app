import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { io } from '../index'; // ⚡ import de socket.io

const prisma = new PrismaClient();

// Typage pour req.user (injecté par authMiddleware)
interface AuthRequest extends Request {
  user?: { id: number };
}

// ✅ Envoyer un message (adapté pour les parkings)
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    const { receiverId, content, parkingId } = req.body;

    if (!senderId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }
    if (!content) {
      return res.status(400).json({ message: 'content est obligatoire' });
    }

    let finalReceiverId = receiverId;

    // 🏢 Si c'est une conversation de parking, trouver le gestionnaire
    if (parkingId) {
      const parking = await prisma.parking.findUnique({
        where: { id: parkingId },
        include: { user: true }
      });

      if (!parking) {
        return res.status(404).json({ message: 'Parking introuvable' });
      }

      if (!parking.user) {
        return res.status(400).json({ message: 'Aucun gestionnaire associé à ce parking' });
      }

      finalReceiverId = parking.user.id;
    } else if (!receiverId) {
      return res.status(400).json({ message: 'receiverId ou parkingId est obligatoire' });
    }

    const message = await prisma.message.create({
      data: { 
        senderId, 
        receiverId: finalReceiverId, 
        content,
        parkingId: parkingId || null
      },
      include: { 
        sender: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        },
        receiver: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        },
        parking: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      },
    });

    // 🔔 Notification en temps réel
    io.to(`user_${finalReceiverId}`).emit("newMessage", message);
    io.to(`user_${senderId}`).emit("newMessage", message);

    res.status(201).json(message);
  } catch (error) {
    console.error("Erreur sendMessage:", error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message', error });
  }
};

// ✅ Récupérer la conversation (adapté pour les parkings)
export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const otherUserId = parseInt(req.params.userId);

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    let whereClause: any = {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    };

    // 🏢 Si l'ID correspond à un parking, adapter la requête
    const parking = await prisma.parking.findUnique({
      where: { id: otherUserId },
      include: { user: true }
    });

    if (parking && parking.user) {
      // C'est un parking, chercher les messages avec le gestionnaire
      whereClause = {
        OR: [
          { senderId: userId, receiverId: parking.user.id, parkingId: otherUserId },
          { senderId: parking.user.id, receiverId: userId, parkingId: otherUserId },
        ],
      };
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      include: { 
        sender: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        }, 
        receiver: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        },
        parking: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      },
    });

    res.json(messages);
  } catch (error) {
    console.error("Erreur getConversation:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation', error });
  }
};

// ✅ Récupérer toutes les conversations (adapté pour les parkings)
export const getUserConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    // Récupérer tous les messages où l'utilisateur est impliqué
    const messages = await prisma.message.findMany({
      where: { 
        OR: [
          { senderId: userId }, 
          { receiverId: userId }
        ] 
      },
      orderBy: { createdAt: 'desc' },
      include: { 
        sender: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        }, 
        receiver: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        },
        parking: {
          select: {
            id: true,
            name: true,
            logo: true,
            city: true
          }
        }
      },
    });

    // 🔄 Structure pour regrouper les conversations
    interface Conversation {
      id: string;
      type: 'user' | 'parking';
      targetUser?: {
        id: number;
        nom: string;
        prenom: string;
        email: string;
        image?: string | null;
        role: string;
      };
      parking?: {
        id: number;
        name: string;
        logo?: string | null; // Permettre null
        city: string;
      };
      lastMessage: any;
      unreadCount: number;
      messages: any[];
    }

    const conversationsMap = new Map<string, Conversation>();

    messages.forEach((msg) => {
      let conversationKey: string;
      let conversationType: 'user' | 'parking' = 'user';
      let targetId: number;

      if (msg.parkingId) {
        // Conversation de parking
        conversationKey = `parking_${msg.parkingId}`;
        conversationType = 'parking';
        targetId = msg.parkingId;
      } else {
        // Conversation directe avec un utilisateur
        const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        conversationKey = `user_${otherUserId}`;
        targetId = otherUserId;
      }

      if (!conversationsMap.has(conversationKey)) {
        const conversation: Conversation = {
          id: conversationKey,
          type: conversationType,
          lastMessage: msg,
          unreadCount: 0,
          messages: [msg]
        };

        if (conversationType === 'parking' && msg.parking) {
          conversation.parking = msg.parking;
        } else if (conversationType === 'user') {
          const targetUser = msg.senderId === userId ? msg.receiver : msg.sender;
          conversation.targetUser = targetUser;
        }

        conversationsMap.set(conversationKey, conversation);
      } else {
        const existingConversation = conversationsMap.get(conversationKey)!;
        existingConversation.messages.push(msg);
        
        // Mettre à jour le dernier message si nécessaire
        if (new Date(msg.createdAt) > new Date(existingConversation.lastMessage.createdAt)) {
          existingConversation.lastMessage = msg;
        }
      }

      // Compter les messages non lus
      const conversation = conversationsMap.get(conversationKey)!;
      if (!msg.read && msg.receiverId === userId) {
        conversation.unreadCount++;
      }
    });

    // Convertir la Map en tableau et trier par date du dernier message
    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    res.json(conversations);
  } catch (error) {
    console.error("Erreur getUserConversations:", error);
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
      include: { 
        sender: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        }, 
        receiver: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        },
        parking: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      },
    });

    // 🔔 Notifier les deux utilisateurs de la mise à jour
    io.to(`user_${message.receiverId}`).emit("updateMessage", updatedMessage);
    io.to(`user_${message.senderId}`).emit("updateMessage", updatedMessage);

    res.json(updatedMessage);
  } catch (error) {
    console.error("Erreur updateMessage:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du message', error });
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

// ✅ Marquer les messages comme lus
export const markMessagesAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { conversationId, type } = req.body; // type: 'user' ou 'parking'

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    let whereClause: any = {
      receiverId: userId,
      read: false
    };

    if (type === 'user' && conversationId) {
      whereClause.senderId = parseInt(conversationId);
      whereClause.parkingId = null;
    } else if (type === 'parking' && conversationId) {
      const parking = await prisma.parking.findUnique({
        where: { id: parseInt(conversationId) },
        include: { user: true }
      });

      if (parking && parking.user) {
        whereClause.senderId = parking.user.id;
        whereClause.parkingId = parseInt(conversationId);
      }
    }

    await prisma.message.updateMany({
      where: whereClause,
      data: { read: true }
    });

    res.json({ message: 'Messages marqués comme lus' });
  } catch (error) {
    console.error("Erreur markMessagesAsRead:", error);
    res.status(500).json({ message: 'Erreur lors du marquage des messages comme lus', error });
  }
};
// ✅ Récupérer la conversation avec un parking spécifique
export const getParkingConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const parkingId = parseInt(req.params.parkingId);

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    // Vérifier que le parking existe et récupérer le gestionnaire
    const parking = await prisma.parking.findUnique({
      where: { id: parkingId },
      include: { user: true }
    });

    if (!parking) {
      return res.status(404).json({ message: 'Parking introuvable' });
    }

    if (!parking.user) {
      return res.status(400).json({ message: 'Aucun gestionnaire associé à ce parking' });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { 
            senderId: userId, 
            receiverId: parking.user.id, 
            parkingId: parkingId 
          },
          { 
            senderId: parking.user.id, 
            receiverId: userId, 
            parkingId: parkingId 
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { 
        sender: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        }, 
        receiver: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        },
        parking: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      },
    });

    res.json(messages);
  } catch (error) {
    console.error("Erreur getParkingConversation:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation avec le parking', error });
  }
};

// ✅ Récupérer la conversation avec un utilisateur spécifique (version améliorée)
export const getUserConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const otherUserId = parseInt(req.params.userId);

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId, parkingId: null },
          { senderId: otherUserId, receiverId: userId, parkingId: null },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { 
        sender: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        }, 
        receiver: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            image: true
          }
        }
      },
    });

    res.json(messages);
  } catch (error) {
    console.error("Erreur getUserConversation:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation', error });
  }
};