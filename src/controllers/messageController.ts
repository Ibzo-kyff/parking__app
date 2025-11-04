import { Request, Response } from 'express';
import { PrismaClient, NotificationType } from '@prisma/client';
import { pusher } from '../index';

// Import de la fonction de notification push
import { notifyUser } from '../utils/sendNotification';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number; nom?: string; prenom?: string };
}

// === ENVOYER UN MESSAGE ===
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    const { receiverId, content, parkingId } = req.body;

    if (!senderId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }
    if (!receiverId || !content?.trim()) {
      return res.status(400).json({ message: 'receiverId et content sont obligatoires' });
    }

    // Vérifier les rôles
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderId }, select: { role: true, nom: true, prenom: true } }),
      prisma.user.findUnique({ where: { id: receiverId }, select: { role: true } }),
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    if (sender.role === receiver.role) {
      return res.status(403).json({ message: 'Les messages doivent être entre client et parking' });
    }

    // Vérifier parkingId si fourni
    if (parkingId) {
      const parking = await prisma.parking.findUnique({ where: { id: parkingId } });
      if (!parking) return res.status(404).json({ message: 'Parking introuvable' });
    }

    const message = await prisma.message.create({
      data: { senderId, receiverId, content: content.trim(), parkingId },
      include: { sender: true, receiver: true, parking: true },
    });

    // === NOTIFICATION EN TEMPS RÉEL (PUSHER) ===
    await pusher.trigger(`user_${receiverId}`, 'newMessage', message);
    await pusher.trigger(`user_${senderId}`, 'newMessage', message);

    // === NOTIFICATION PUSH EXPO ===
    const senderName = `${sender.nom || ''} ${sender.prenom || ''}`.trim() || 'Quelqu’un';
    await notifyUser(
      receiverId,
      `Nouveau message de ${senderName}`,
      content.substring(0, 100),
      NotificationType.MESSAGE,
      {
        messageId: message.id,
        senderId,
        screen: 'Chat',
        parkingId: parkingId || undefined,
      }
    ).catch(err => console.error('Échec push Expo (message):', err.message));

    // === NOTIFICATION EN BASE (optionnel, tu l’as déjà) ===
    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: `Nouveau message de ${senderName}`,
        message: content.substring(0, 100),
        type: 'MESSAGE',
      },
    });

    res.status(201).json(message);
  } catch (error: any) {
    console.error('Erreur sendMessage:', error);
    res.status(500).json({ message: 'Erreur lors de l’envoi du message' });
  }
};

// === RÉCUPÉRER LA CONVERSATION ===
export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const otherUserId = parseInt(req.params.userId);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    if (!userId) return res.status(401).json({ message: 'Utilisateur non authentifié' });

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      include: { sender: true, receiver: true, parking: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await prisma.message.count({
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
      totalPages: Math.ceil(total / pageSize),
      currentPage: page,
    });
  } catch (error) {
    console.error('Erreur getConversation:', error);
    res.status(500).json({ message: 'Erreur récupération conversation' });
  }
};

// === CONVERSATIONS GROUPÉES ===
export const getUserConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Non authentifié' });

    const conversations = await prisma.message.groupBy({
      by: ['senderId', 'receiverId'],
      where: { OR: [{ senderId: userId }, { receiverId: userId }], deletedAt: null },
      _max: { createdAt: true },
    });

    const latestMessages = await prisma.message.findMany({
      where: {
        OR: conversations
          .filter(c => c._max.createdAt !== null)
          .map(c => ({
            senderId: c.senderId,
            receiverId: c.receiverId,
            createdAt: c._max.createdAt!,
            deletedAt: null,
          })),
      },
      include: { sender: true, receiver: true, parking: true },
      orderBy: { createdAt: 'desc' },
    });

    const map: Record<number, any> = {};
    latestMessages.forEach(msg => {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!map[otherId]) map[otherId] = { user: msg.senderId === userId ? msg.receiver : msg.sender, lastMessage: msg };
    });

    res.json(Object.values(map));
  } catch (error) {
    console.error('Erreur getUserConversations:', error);
    res.status(500).json({ message: 'Erreur récupération conversations' });
  }
};

// === METTRE À JOUR UN MESSAGE ===
export const updateMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const messageId = parseInt(req.params.id);
    const { content } = req.body;

    if (!userId) return res.status(401).json({ message: 'Non authentifié' });
    if (!content?.trim()) return res.status(400).json({ message: 'Contenu requis' });

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ message: 'Message introuvable' });
    if (message.senderId !== userId) return res.status(403).json({ message: 'Accès refusé' });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content: content.trim() },
      include: { sender: true, receiver: true, parking: true },
    });

    await pusher.trigger(`user_${message.receiverId}`, 'updateMessage', updated);
    await pusher.trigger(`user_${message.senderId}`, 'updateMessage', updated);

    // Optionnel : push de mise à jour
    await notifyUser(
      message.receiverId,
      'Message modifié',
      `${req.user?.nom} a modifié un message.`,
      NotificationType.MESSAGE,
      { messageId, action: 'updated' }
    ).catch(() => {});

    res.json(updated);
  } catch (error) {
    console.error('Erreur updateMessage:', error);
    res.status(500).json({ message: 'Erreur mise à jour' });
  }
};

// === SUPPRIMER UN MESSAGE (soft) ===
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const messageId = parseInt(req.params.id);

    if (!userId) return res.status(401).json({ message: 'Non authentifié' });

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ message: 'Message introuvable' });
    if (message.senderId !== userId) return res.status(403).json({ message: 'Accès refusé' });

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    await pusher.trigger(`user_${message.receiverId}`, 'deleteMessage', messageId);
    await pusher.trigger(`user_${message.senderId}`, 'deleteMessage', messageId);

    res.json({ message: 'Message supprimé' });
  } catch (error) {
    console.error('Erreur deleteMessage:', error);
    res.status(500).json({ message: 'Erreur suppression' });
  }
};

// === MARQUER COMME LU ===
export const markMessageAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const messageId = parseInt(req.params.id);

    if (!userId) return res.status(401).json({ message: 'Non authentifié' });

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ message: 'Message introuvable' });
    if (message.receiverId !== userId) return res.status(403).json({ message: 'Accès refusé' });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { read: true },
      include: { sender: true, receiver: true, parking: true },
    });

    await pusher.trigger(`user_${message.senderId}`, 'messageRead', updated);
    await pusher.trigger(`user_${message.receiverId}`, 'messageRead', updated);

    res.json(updated);
  } catch (error) {
    console.error('Erreur markMessageAsRead:', error);
    res.status(500).json({ message: 'Erreur marquage lu' });
  }
};







// import { Request, Response } from 'express';
// import { PrismaClient, NotificationType } from '@prisma/client';
// import { pusher } from '../index';

// // Import de la fonction de notification push
// import { notifyUser } from '../utils/sendNotification';

// const prisma = new PrismaClient();

// interface AuthRequest extends Request {
//   user?: { id: number; nom?: string; prenom?: string };
// }

// // === ENVOYER UN MESSAGE ===
// export const sendMessage = async (req: AuthRequest, res: Response) => {
//   try {
//     const senderId = req.user?.id;
//     const { receiverId, content, parkingId } = req.body;

//     if (!senderId) {
//       return res.status(401).json({ message: 'Utilisateur non authentifié' });
//     }
//     if (!receiverId || !content?.trim()) {
//       return res.status(400).json({ message: 'receiverId et content sont obligatoires' });
//     }

//     // Vérifier les rôles
//     const [sender, receiver] = await Promise.all([
//       prisma.user.findUnique({ where: { id: senderId }, select: { role: true, nom: true, prenom: true } }),
//       prisma.user.findUnique({ where: { id: receiverId }, select: { role: true } }),
//     ]);

//     if (!sender || !receiver) {
//       return res.status(404).json({ message: 'Utilisateur introuvable' });
//     }
//     if (sender.role === receiver.role) {
//       return res.status(403).json({ message: 'Les messages doivent être entre client et parking' });
//     }

//     // Vérifier parkingId si fourni
//     if (parkingId) {
//       const parking = await prisma.parking.findUnique({ where: { id: parkingId } });
//       if (!parking) return res.status(404).json({ message: 'Parking introuvable' });
//     }

//     const message = await prisma.message.create({
//       data: { senderId, receiverId, content: content.trim(), parkingId },
//       include: { sender: true, receiver: true, parking: true },
//     });

//     // === NOTIFICATION EN TEMPS RÉEL (PUSHER) ===
//     await pusher.trigger(`user_${receiverId}`, 'newMessage', message);
//     await pusher.trigger(`user_${senderId}`, 'newMessage', message);

//     // === NOTIFICATION PUSH EXPO ===
//     const senderName = `${sender.nom || ''} ${sender.prenom || ''}`.trim() || 'Quelqu’un';
//     await notifyUser(
//       receiverId,
//       `Nouveau message de ${senderName}`,
//       content.substring(0, 100),
//       NotificationType.MESSAGE,
//       {
//         messageId: message.id,
//         senderId,
//         screen: 'Chat',
//         parkingId: parkingId || undefined,
//       }
//     ).catch(err => console.error('Échec push Expo (message):', err.message));

//     // === NOTIFICATION EN BASE (optionnel, tu l’as déjà) ===
//     await prisma.notification.create({
//       data: {
//         userId: receiverId,
//         title: `Nouveau message de ${senderName}`,
//         message: content.substring(0, 100),
//         type: 'MESSAGE',
//       },
//     });

//     res.status(201).json(message);
//   } catch (error: any) {
//     console.error('Erreur sendMessage:', error);
//     res.status(500).json({ message: 'Erreur lors de l’envoi du message' });
//   }
// };

// // === RÉCUPÉRER LA CONVERSATION ===
// export const getConversation = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.id;
//     const otherUserId = parseInt(req.params.userId);
//     const page = parseInt(req.query.page as string) || 1;
//     const pageSize = parseInt(req.query.pageSize as string) || 20;

//     if (!userId) return res.status(401).json({ message: 'Utilisateur non authentifié' });

//     const messages = await prisma.message.findMany({
//       where: {
//         OR: [
//           { senderId: userId, receiverId: otherUserId },
//           { senderId: otherUserId, receiverId: userId },
//         ],
//         deletedAt: null,
//       },
//       orderBy: { createdAt: 'asc' },
//       include: { sender: true, receiver: true, parking: true },
//       skip: (page - 1) * pageSize,
//       take: pageSize,
//     });

//     const total = await prisma.message.count({
//       where: {
//         OR: [
//           { senderId: userId, receiverId: otherUserId },
//           { senderId: otherUserId, receiverId: userId },
//         ],
//         deletedAt: null,
//       },
//     });

//     res.json({
//       messages,
//       totalPages: Math.ceil(total / pageSize),
//       currentPage: page,
//     });
//   } catch (error) {
//     console.error('Erreur getConversation:', error);
//     res.status(500).json({ message: 'Erreur récupération conversation' });
//   }
// };

// // === CONVERSATIONS GROUPÉES ===
// export const getUserConversations = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.id;
//     if (!userId) return res.status(401).json({ message: 'Non authentifié' });

//     const conversations = await prisma.message.groupBy({
//       by: ['senderId', 'receiverId'],
//       where: { OR: [{ senderId: userId }, { receiverId: userId }], deletedAt: null },
//       _max: { createdAt: true },
//     });

//     const latestMessages = await prisma.message.findMany({
//       where: {
//         OR: conversations
//           .filter(c => c._max.createdAt !== null)
//           .map(c => ({
//             senderId: c.senderId,
//             receiverId: c.receiverId,
//             createdAt: c._max.createdAt!,
//             deletedAt: null,
//           })),
//       },
//       include: { sender: true, receiver: true, parking: true },
//       orderBy: { createdAt: 'desc' },
//     });

//     const map: Record<number, any> = {};
//     latestMessages.forEach(msg => {
//       const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
//       if (!map[otherId]) map[otherId] = { user: msg.senderId === userId ? msg.receiver : msg.sender, lastMessage: msg };
//     });

//     res.json(Object.values(map));
//   } catch (error) {
//     console.error('Erreur getUserConversations:', error);
//     res.status(500).json({ message: 'Erreur récupération conversations' });
//   }
// };

// // === METTRE À JOUR UN MESSAGE ===
// export const updateMessage = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.id;
//     const messageId = parseInt(req.params.id);
//     const { content } = req.body;

//     if (!userId) return res.status(401).json({ message: 'Non authentifié' });
//     if (!content?.trim()) return res.status(400).json({ message: 'Contenu requis' });

//     const message = await prisma.message.findUnique({ where: { id: messageId } });
//     if (!message) return res.status(404).json({ message: 'Message introuvable' });
//     if (message.senderId !== userId) return res.status(403).json({ message: 'Accès refusé' });

//     const updated = await prisma.message.update({
//       where: { id: messageId },
//       data: { content: content.trim() },
//       include: { sender: true, receiver: true, parking: true },
//     });

//     await pusher.trigger(`user_${message.receiverId}`, 'updateMessage', updated);
//     await pusher.trigger(`user_${message.senderId}`, 'updateMessage', updated);

//     // Optionnel : push de mise à jour
//     await notifyUser(
//       message.receiverId,
//       'Message modifié',
//       `${req.user?.nom} a modifié un message.`,
//       NotificationType.MESSAGE,
//       { messageId, action: 'updated' }
//     ).catch(() => {});

//     res.json(updated);
//   } catch (error) {
//     console.error('Erreur updateMessage:', error);
//     res.status(500).json({ message: 'Erreur mise à jour' });
//   }
// };

// // === SUPPRIMER UN MESSAGE (soft) ===
// export const deleteMessage = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.id;
//     const messageId = parseInt(req.params.id);

//     if (!userId) return res.status(401).json({ message: 'Non authentifié' });

//     const message = await prisma.message.findUnique({ where: { id: messageId } });
//     if (!message) return res.status(404).json({ message: 'Message introuvable' });
//     if (message.senderId !== userId) return res.status(403).json({ message: 'Accès refusé' });

//     await prisma.message.update({
//       where: { id: messageId },
//       data: { deletedAt: new Date() },
//     });

//     await pusher.trigger(`user_${message.receiverId}`, 'deleteMessage', messageId);
//     await pusher.trigger(`user_${message.senderId}`, 'deleteMessage', messageId);

//     res.json({ message: 'Message supprimé' });
//   } catch (error) {
//     console.error('Erreur deleteMessage:', error);
//     res.status(500).json({ message: 'Erreur suppression' });
//   }
// };

// // === MARQUER COMME LU ===
// export const markMessageAsRead = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.id;
//     const messageId = parseInt(req.params.id);

//     if (!userId) return res.status(401).json({ message: 'Non authentifié' });

//     const message = await prisma.message.findUnique({ where: { id: messageId } });
//     if (!message) return res.status(404).json({ message: 'Message introuvable' });
//     if (message.receiverId !== userId) return res.status(403).json({ message: 'Accès refusé' });

//     const updated = await prisma.message.update({
//       where: { id: messageId },
//       data: { read: true },
//       include: { sender: true, receiver: true, parking: true },
//     });

//     await pusher.trigger(`user_${message.senderId}`, 'messageRead', updated);
//     await pusher.trigger(`user_${message.receiverId}`, 'messageRead', updated);

//     res.json(updated);
//   } catch (error) {
//     console.error('Erreur markMessageAsRead:', error);
//     res.status(500).json({ message: 'Erreur marquage lu' });
//   }
// };