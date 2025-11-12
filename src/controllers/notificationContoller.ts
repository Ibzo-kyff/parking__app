// src/controllers/notificationController.ts
import {  Response } from 'express'; // ← AVANT
import { PrismaClient, NotificationType } from '@prisma/client';
import { z } from 'zod';
import { Expo } from 'expo-server-sdk';

import { AuthRequest } from '../middleware/authMiddleware'; // ← ICI !
const prisma = new PrismaClient();
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// === SCHÉMA DE VALIDATION ===
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
    console.warn('Token Expo invalide:', token);
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
        console.warn('Token Expo périmé → suppression:', token);
        await prisma.user.updateMany({
          where: { expoPushToken: token },
          data: { expoPushToken: null },
        });
      } else {
        console.error('Erreur push Expo:', receipt.details?.error);
      }
    } else {
      console.log('Push envoyé avec succès:', receipt.id);
    }
    return receipt;
  } catch (error: any) {
    console.error('Erreur envoi push:', error.message);
    return null;
  }
};

// === VÉRIFIER PROPRIÉTÉ DE LA NOTIFICATION ===
const checkNotificationOwnership = async (notificationId: number, userId: number) => {
  return await prisma.notification.findFirst({
    where: {
      id: notificationId,
      OR: [
        { userId }, // Notification directe à l'utilisateur
        { parking: { userId } }, // Notification au parking → propriétaire
      ],
    },
  });
};

// === CRÉER UNE NOTIFICATION (admin/système) ===
export const createNotification = async (req: AuthRequest, res: Response) => {
  try {
    const data = createNotificationSchema.parse(req.body);
    const { userId, parkingId, title, message, type } = data;

    // Validation : un seul des deux
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

    // Récupérer le token Expo
    let token: string | null = null;
    if (userId && notification.user?.expoPushToken) {
      token = notification.user.expoPushToken;
    } else if (parkingId && notification.parking?.user?.expoPushToken) {
      token = notification.parking.user.expoPushToken;
    }

    // Envoyer push
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

// === LISTE DES NOTIFICATIONS (SEULEMENT LES SIENNES) ===
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { read, type } = req.query;

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { parking: { userId } },
        ],
        ...(read !== undefined && { read: read === 'true' }),
        ...(type && { type: type as NotificationType }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, nom: true, prenom: true } },
        parking: { select: { id: true, name: true } },
      },
    });

    return res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('Erreur get notifications:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// === DÉTAIL D'UNE NOTIFICATION ===
export const getNotificationById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notificationId = Number(req.params.id);

    console.log(`[DEBUG] User ID: ${userId} | Notification ID: ${notificationId}`);

    const notification = await checkNotificationOwnership(notificationId, userId);

    if (!notification) {
      console.log('[DEBUG] Accès refusé ou notification inexistante');
      return res.status(404).json({ error: 'Notification non trouvée ou accès refusé' });
    }

    const fullNotification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: { select: { id: true, email: true, nom: true, prenom: true } },
        parking: {
          select: {
            id: true,
            name: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    return res.json({ success: true, data: fullNotification });
  } catch (err) {
    console.error('Erreur get notification:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// === MARQUER COMME LUE ===
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notificationId = Number(req.params.id);

    const notification = await checkNotificationOwnership(notificationId, userId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification non trouvée ou accès refusé' });
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return res.json({ success: true, message: 'Marquée comme lue', data: updated });
  } catch (err) {
    console.error('Erreur mark as read:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// === SUPPRIMER UNE NOTIFICATION ===
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notificationId = Number(req.params.id);

    const notification = await checkNotificationOwnership(notificationId, userId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification non trouvée ou accès refusé' });
    }

    await prisma.notification.delete({ where: { id: notificationId } });

    return res.json({ success: true, message: 'Supprimée avec succès' });
  } catch (err) {
    console.error('Erreur delete notification:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};