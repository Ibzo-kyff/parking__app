// controllers/notificationController.ts
import { Request, Response } from 'express';
import { PrismaClient, NotificationType } from '@prisma/client';
import { z } from 'zod';
import { Expo } from 'expo-server-sdk';

const prisma = new PrismaClient();
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// === SCHÉMA ===
const createNotificationSchema = z.object({
  title: z.string().min(3).max(100),
  message: z.string().min(5).max(500),
  type: z.nativeEnum(NotificationType),
  userId: z.number().optional(),
  parkingId: z.number().optional(),
});

// === ENVOI PUSH + NETTOYAGE TOKEN ===
const sendPushNotification = async (
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<any> => {
  if (!Expo.isExpoPushToken(token)) {
    console.warn('Token invalide:', token);
    return null;
  }

  const message = {
    to: token,
    sound: 'default' as const,
    title,
    body: body.substring(0, 150) + (body.length > 150 ? '...' : ''),
    data,
    priority: 'high' as const,
  };

  try {
    const receipts = await expo.sendPushNotificationsAsync([message]);
    const receipt = receipts[0];

    if (receipt.status === 'error') {
      if (receipt.details?.error === 'DeviceNotRegistered') {
        console.warn('Token périmé → suppression:', token);
        await prisma.user.updateMany({
          where: { expoPushToken: token },
          data: { expoPushToken: null },
        });
      } else {
        console.error('Erreur push:', receipt.details?.error);
      }
    } else {
      console.log('Push envoyé:', receipt.id);
    }
    return receipt;
  } catch (error: any) {
    console.error('Erreur envoi push:', error.message);
    return null;
  }
};

// === CRÉER NOTIFICATION ===
export const createNotification = async (req: Request, res: Response) => {
  try {
    const data = createNotificationSchema.parse(req.body);
    const { userId, parkingId, title, message, type } = data;

    // Validation exclusive
    if ((userId && parkingId) || (!userId && !parkingId)) {
      return res.status(400).json({
        error: 'Doit avoir soit userId, soit parkingId (pas les deux)',
      });
    }

    // Vérifier existence
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    if (parkingId) {
      const parking = await prisma.parking.findUnique({ where: { id: parkingId } });
      if (!parking) return res.status(404).json({ error: 'Parking non trouvé' });
    }

    // Créer la notification
    const notification = await prisma.notification.create({
      data: { title, message, type, userId, parkingId },
      include: {
        user: { select: { id: true, expoPushToken: true } },
        parking: { select: { id: true, user: { select: { expoPushToken: true } } } },
      },
    });

    // Récupérer le token
    let token: string | null = null;
    if (userId && notification.user?.expoPushToken) {
      token = notification.user.expoPushToken;
    } else if (parkingId && notification.parking?.user?.expoPushToken) {
      token = notification.parking.user.expoPushToken;
    }

    // Envoyer le push
    if (token) {
      await sendPushNotification(token, title, message, {
        notificationId: notification.id,
        type,
        screen: userId ? 'UserNotifications' : 'ParkingDetails',
      });
    } else {
      console.info('Aucun token Expo trouvé pour cette notification');
    }

    return res.status(201).json({ success: true, data: notification });
  } catch (err: any) {
    console.error('Erreur création notification:', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: err.issues });
    }
    return res.status(500).json({
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// === LES AUTRES FONCTIONS (get, mark, delete) RESTENT IDENTIQUES ===
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { userId, parkingId, read, type } = req.query;

    const notifications = await prisma.notification.findMany({
      where: {
        ...(userId && { userId: Number(userId) }),
        ...(parkingId && { parkingId: Number(parkingId) }),
        ...(read !== undefined && { read: read === 'true' }),
        ...(type && { type: type as NotificationType }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true } },
        parking: { select: { id: true, name: true } },
      },
    });

    return res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('Erreur get notifications:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const getNotificationById = async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        user: { select: { id: true, email: true } },
        parking: { select: { id: true, name: true } },
      },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }

    return res.json({ success: true, data: notification });
  } catch (err) {
    console.error('Erreur get notification:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: Number(req.params.id) },
      data: { read: true },
    });

    return res.json({
      success: true,
      message: 'Marquée comme lue',
      data: notification,
    });
  } catch (err) {
    console.error('Erreur mark as read:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    await prisma.notification.delete({
      where: { id: Number(req.params.id) },
    });

    return res.json({ success: true, message: 'Supprimée avec succès' });
  } catch (err) {
    console.error('Erreur delete notification:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};