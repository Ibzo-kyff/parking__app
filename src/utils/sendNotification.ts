// utils/sendNotification.ts - Version simplifiée
import { PrismaClient, NotificationType } from '@prisma/client';
import { Expo } from 'expo-server-sdk';
import { sendFirebasePush } from './firebaseAdmin';

const prisma = new PrismaClient();
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export const sendPushNotification = async (
  token: string | null | undefined,
  title: string,
  body: string,
  data: Record<string, unknown>
) => {
  if (!token?.trim()) {
    console.warn('Token push manquant.');
    return null;
  }

  const normalizedToken = token.trim();
  const messageBody = body.substring(0, 150) + (body.length > 150 ? '...' : '');

  if (Expo.isExpoPushToken(normalizedToken)) {
    const message = {
      to: normalizedToken,
      sound: 'default' as const,
      title,
      body: messageBody,
      data,
      priority: 'high' as const,
    };

    try {
      const receipts = await expo.sendPushNotificationsAsync([message]);
      const receipt = receipts[0];

      if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
        await prisma.user.updateMany({
          where: { expoPushToken: normalizedToken },
          data: { expoPushToken: null },
        });
      }

      return receipt;
    } catch (error: unknown) {
      console.error('Erreur envoi push Expo:', error);
      return null;
    }
  }

  try {
    return await sendFirebasePush(normalizedToken, title, messageBody, data);
  } catch (error: unknown) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;

    if (
      errorCode === 'messaging/registration-token-not-registered'
      || errorCode === 'messaging/invalid-registration-token'
    ) {
      await prisma.user.updateMany({
        where: { expoPushToken: normalizedToken },
        data: { expoPushToken: null },
      });
    }

    console.error('Erreur envoi push Firebase:', error);
    return null;
  }
};

// === NOTIFIER UN UTILISATEUR (PUSH + BDD) ===
export const notifyUser = async (
  userId: number,
  title: string,
  message: string,
  type: NotificationType,
  data: Record<string, unknown> = {}
) => {
  try {
    // 1. Créer la notification en BDD (pour l'historique)
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        userId,
      },
    });

    // 2. Récupérer le token pour push
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true, role: true },
    });

    // 3. Envoyer push si token valide
    if (user?.expoPushToken) {
      await sendPushNotification(user.expoPushToken, title, message, {
        notificationId: notification.id,
        url: user.role === 'PARKING'
          ? '/dashboard/parking/notifications'
          : user.role === 'ADMIN'
            ? '/dashboard/admin/notifications'
            : '/dashboard/client/notifications',
        ...data,
      });
    }

    return notification;
  } catch (error: any) {
    console.error('Erreur notifyUser:', error);
    throw error;
  }
};

// === NOTIFIER LE PROPRIÉTAIRE D'UN PARKING (PUSH + BDD) ===
export const notifyParkingOwner = async (
  parkingId: number,
  title: string,
  message: string,
  type: NotificationType,
  data: Record<string, unknown> = {}
) => {
  try {
    // 1. Récupérer l'utilisateur propriétaire
    const parking = await prisma.parking.findUnique({
      where: { id: parkingId },
      include: { user: true },
    });

    if (!parking?.user) return null;

    // 2. Créer la notification en BDD
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        parkingId,
        userId: parking.user.id, // Associer aussi à l'utilisateur
      },
    });

    // 3. Envoyer push si token valide
    if (parking.user.expoPushToken) {
      await sendPushNotification(parking.user.expoPushToken, title, message, {
        notificationId: notification.id,
        url: '/dashboard/parking/notifications',
        ...data,
      });
    }

    return notification;
  } catch (error: any) {
    console.error('Erreur notifyParkingOwner:', error);
    throw error;
  }
};