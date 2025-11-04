// utils/sendNotification.ts
import { PrismaClient, NotificationType } from '@prisma/client';
import { Expo } from 'expo-server-sdk';

// === Initialisation ===
const prisma = new PrismaClient();
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// === Fonction privée d'envoi push (dupliquée ici pour éviter couplage) ===
const sendPush = async (
  token: string | null | undefined,
  title: string,
  body: string,
  data: Record<string, unknown>
) => {
  if (!token || !Expo.isExpoPushToken(token)) {
    console.warn('Token Expo invalide ou manquant:', token);
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
    console.log('Push envoyé:', { title, token, receipt: receipts[0] });
    return receipts[0];
  } catch (error: any) {
    console.error('Erreur envoi push:', error.message);
    return null;
  }
};

// === NOTIFIER UN UTILISATEUR ===
export const notifyUser = async (
  userId: number,
  title: string,
  message: string,
  type: NotificationType,
  data: Record<string, unknown> = {}
) => {
  try {
    // Récupérer le token + créer la notif en parallèle
    const [user, notification] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { expoPushToken: true },
      }),
      prisma.notification.create({
        data: {
          title,
          message,
          type,
          userId,
        },
      }),
    ]);

    // Envoyer le push si token valide
    if (user?.expoPushToken) {
      await sendPush(user.expoPushToken, title, message, {
        notificationId: notification.id,
        ...data,
      });
    } else {
      console.info('Aucun token Expo pour userId:', userId);
    }

    return notification;
  } catch (error: any) {
    console.error('Erreur notifyUser:', error);
    throw new Error('Échec envoi notification utilisateur');
  }
};

// === NOTIFIER LE PROPRIÉTAIRE D'UN PARKING ===
export const notifyParkingOwner = async (
  parkingId: number,
  title: string,
  message: string,
  type: NotificationType,
  data: Record<string, unknown> = {}
) => {
  try {
    const [parking, notification] = await Promise.all([
      prisma.parking.findUnique({
        where: { id: parkingId },
        select: {
          user: {
            select: { expoPushToken: true },
          },
        },
      }),
      prisma.notification.create({
        data: {
          title,
          message,
          type,
          parkingId,
        },
      }),
    ]);

    const token = parking?.user?.expoPushToken;

    if (token) {
      await sendPush(token, title, message, {
        notificationId: notification.id,
        ...data,
      });
    } else {
      console.info('Aucun token pour le propriétaire du parking:', parkingId);
    }

    return notification;
  } catch (error: any) {
    console.error('Erreur notifyParkingOwner:', error);
    throw new Error('Échec envoi notification parking');
  }
};