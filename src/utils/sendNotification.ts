// utils/sendNotification.ts - Version simplifiée
import { PrismaClient, NotificationType } from '@prisma/client';
import { Expo } from 'expo-server-sdk';

const prisma = new PrismaClient();
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export const sendPushNotification = async (
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
    
    // Nettoyage token périmé
    const receipt = receipts[0];
    if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
      await prisma.user.updateMany({
        where: { expoPushToken: token },
        data: { expoPushToken: null },
      });
    }
    
    return receipt;
  } catch (error: any) {
    console.error('Erreur envoi push:', error.message);
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
      select: { expoPushToken: true },
    });

    // 3. Envoyer push si token valide
    if (user?.expoPushToken) {
      await sendPushNotification(user.expoPushToken, title, message, {
        notificationId: notification.id,
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
        ...data,
      });
    }

    return notification;
  } catch (error: any) {
    console.error('Erreur notifyParkingOwner:', error);
    throw error;
  }
};