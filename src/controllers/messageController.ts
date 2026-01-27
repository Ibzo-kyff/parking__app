import { Request, Response } from 'express';
import { PrismaClient, NotificationType } from '@prisma/client';
import { pusher } from '../index';
import { notifyUser } from '../utils/sendNotification';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number; nom?: string; prenom?: string };
}

const publicUserSelect = {
  id: true,
  nom: true,
  prenom: true,
  image: true,
  role: true,
};

const publicParkingSelect = {
  id: true,
  name: true,
  logo: true,
};

const mapMessageToPublic = (message: any, clientTempId?: string) => ({
  id: message.id,
  senderId: message.senderId,
  receiverId: message.receiverId,
  content: message.content,
  createdAt: message.createdAt,
  read: message.read,
  parkingId: message.parkingId,
  deletedAt: message.deletedAt ?? null,

  sender: message.sender,
  receiver: message.receiver,
  parking: message.parking ?? null,

  clientTempId,
});

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    const { receiverId, content, parkingId, clientTempId } = req.body;

    if (!senderId) return res.status(401).json({ message: 'Utilisateur non authentifié' });
    if (!receiverId || !content?.trim())
      return res.status(400).json({ message: 'receiverId et content sont obligatoires' });

    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({
        where: { id: senderId },
        select: { role: true, nom: true, prenom: true },
      }),
      prisma.user.findUnique({
        where: { id: receiverId },
        select: { role: true },
      }),
    ]);

    if (!sender || !receiver) return res.status(404).json({ message: 'Utilisateur introuvable' });
    if (sender.role === receiver.role)
      return res.status(403).json({ message: 'Messages autorisés seulement entre client et parking' });

    if (parkingId) {
      const parking = await prisma.parking.findUnique({ where: { id: parkingId } });
      if (!parking) return res.status(404).json({ message: 'Parking introuvable' });
    }

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content: content.trim(),
        parkingId,
      },
      include: {
        sender: { select: publicUserSelect },
        receiver: { select: publicUserSelect },
        parking: parkingId ? { select: publicParkingSelect } : false,
      },
    });

    const payload = mapMessageToPublic(message, clientTempId);

    // PUSHER (payload sécurisé)
    await Promise.all([
      pusher.trigger(`private-user-${receiverId}`, 'newMessage', payload),
      pusher.trigger(`private-user-${senderId}`, 'newMessage', payload),
    ]);

    // NOTIFICATION PUSH
    const senderName =
      `${sender.nom || ''} ${sender.prenom || ''}`.trim() || 'Quelqu’un';

    notifyUser(
      receiverId,
      `Nouveau message de ${senderName}`,
      content.substring(0, 100),
      NotificationType.MESSAGE,
      {
        messageId: message.id,
        senderId,
        screen: 'Chat',
        parkingId: parkingId ?? undefined,
      }
    ).catch(() => {});

    // NOTIFICATION DB
    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: `Nouveau message de ${senderName}`,
        message: content.substring(0, 100),
        type: 'MESSAGE',
      },
    });

    res.status(201).json(payload);
  } catch (error) {
    console.error('Erreur sendMessage:', error);
    res.status(500).json({ message: 'Erreur lors de l’envoi du message' });
  }
};

export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const otherUserId = parseInt(req.params.userId);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const parkingId = req.query.parkingId
      ? parseInt(req.query.parkingId as string)
      : undefined;

    if (!userId) return res.status(401).json({ message: 'Utilisateur non authentifié' });

    const where: any = {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
      deletedAt: null,
    };

    if (parkingId !== undefined) where.parkingId = parkingId;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: publicUserSelect },
          receiver: { select: publicUserSelect },
          parking: { select: publicParkingSelect },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.message.count({ where }),
    ]);

    res.json({
      messages: messages.map(m => mapMessageToPublic(m)),
      totalPages: Math.ceil(total / pageSize),
      currentPage: page,
      parkingId,
    });
  } catch (error) {
    console.error('Erreur getConversation:', error);
    res.status(500).json({ message: 'Erreur récupération conversation' });
  }
};

export const getUserConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Non authentifié' });

    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: publicUserSelect },
        receiver: { select: publicUserSelect },
        parking: { select: publicParkingSelect },
      },
    });

    const map: Record<number, any> = {};

    messages.forEach(msg => {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!map[otherId]) {
        map[otherId] = {
          user: msg.senderId === userId ? msg.receiver : msg.sender,
          lastMessage: mapMessageToPublic(msg),
        };
      }
    });

    res.json(Object.values(map));
  } catch (error) {
    console.error('Erreur getUserConversations:', error);
    res.status(500).json({ message: 'Erreur récupération conversations' });
  }
};

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
      include: {
        sender: { select: publicUserSelect },
        receiver: { select: publicUserSelect },
        parking: { select: publicParkingSelect },
      },
    });

    const payload = mapMessageToPublic(updated);

    await Promise.all([
      pusher.trigger(`private-user-${message.receiverId}`, 'updateMessage', payload),
      pusher.trigger(`private-user-${message.senderId}`, 'updateMessage', payload),
    ]);

    res.json(payload);
  } catch (error) {
    console.error('Erreur updateMessage:', error);
    res.status(500).json({ message: 'Erreur mise à jour' });
  }
};

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

    await Promise.all([
      pusher.trigger(`private-user-${message.receiverId}`, 'deleteMessage', messageId),
      pusher.trigger(`private-user-${message.senderId}`, 'deleteMessage', messageId),
    ]);

    res.json({ message: 'Message supprimé' });
  } catch (error) {
    console.error('Erreur deleteMessage:', error);
    res.status(500).json({ message: 'Erreur suppression' });
  }
};

export const markMessageAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const messageId = parseInt(req.params.id);

    if (!userId) return res.status(401).json({ message: 'Non authentifié' });

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ message: 'Message introuvable' });
    if (message.receiverId !== userId)
      return res.status(403).json({ message: 'Accès refusé' });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { read: true },
      include: {
        sender: { select: publicUserSelect },
        receiver: { select: publicUserSelect },
        parking: { select: publicParkingSelect },
      },
    });

    const payload = mapMessageToPublic(updated);

    await Promise.all([
      pusher.trigger(`private-user-${message.senderId}`, 'messageRead', payload),
      pusher.trigger(`private-user-${message.receiverId}`, 'messageRead', payload),
    ]);

    res.json(payload);
  } catch (error) {
    console.error('Erreur markMessageAsRead:', error);
    res.status(500).json({ message: 'Erreur marquage lu' });
  }
};
