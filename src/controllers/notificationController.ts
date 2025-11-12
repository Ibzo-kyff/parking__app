import { Response } from "express";
import { PrismaClient, NotificationType } from "@prisma/client";
import { z } from "zod";
import { Expo } from "expo-server-sdk";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// === SCHEMA DE VALIDATION ===
const createNotificationSchema = z.object({
  title: z.string().min(3).max(100),
  message: z.string().min(5).max(500),
  type: z.nativeEnum(NotificationType),
  userId: z.number().optional(),
  parkingId: z.number().optional(),
});

// === ENVOI PUSH EXPO ===
const sendPushNotification = async (
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>
) => {
  if (!Expo.isExpoPushToken(token)) {
    console.warn("Token Expo invalide:", token);
    return;
  }

  try {
    const receipts = await expo.sendPushNotificationsAsync([
      {
        to: token,
        sound: "default",
        title,
        body: body.length > 150 ? body.substring(0, 150) + "..." : body,
        data,
        priority: "high",
      },
    ]);
    console.log("Push envoyé :", receipts[0]);
  } catch (error: any) {
    console.error("Erreur envoi push :", error.message);
  }
};

// === CRÉER UNE NOTIFICATION ===
export const createNotification = async (req: AuthRequest, res: Response) => {
  try {
    const data = createNotificationSchema.parse(req.body);
    const { userId, parkingId, title, message, type } = data;

    // Validation : un seul des deux doit être défini
    if ((userId && parkingId) || (!userId && !parkingId)) {
      return res.status(400).json({
        error: "Doit avoir soit userId, soit parkingId (pas les deux)",
      });
    }

    // Vérification existence
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    } else if (parkingId) {
      const parking = await prisma.parking.findUnique({ where: { id: parkingId } });
      if (!parking) return res.status(404).json({ error: "Parking non trouvé" });
    }

    // Création
    const notification = await prisma.notification.create({
      data: { title, message, type, userId, parkingId },
      include: {
        user: { select: { expoPushToken: true } },
        parking: { select: { user: { select: { expoPushToken: true } } } },
      },
    });

    // Envoi push
    const token =
      notification.user?.expoPushToken ||
      notification.parking?.user?.expoPushToken;
    if (token) {
      await sendPushNotification(token, title, message, {
        notificationId: notification.id,
        type,
      });
    }

    return res.status(201).json({ success: true, data: notification });
  } catch (err: any) {
    console.error("Erreur création notification:", err);
    return res.status(500).json({
      error: "Erreur serveur",
      details: err.message,
    });
  }
};

// === GET NOTIFICATIONS (Uniquement celles de l'utilisateur connecté) ===
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId }, // notifications directes à l'utilisateur
          { parking: { userId } }, // notifications liées à son parking
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        read: true,
        createdAt: true,
        parkingId: true,
      },
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (err) {
    console.error("Erreur récupération notifications:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// === MARQUER COMME LUE ===
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notificationId = Number(req.params.id);

    const notif = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        OR: [{ userId }, { parking: { userId } }],
      },
    });

    if (!notif)
      return res
        .status(404)
        .json({ error: "Notification non trouvée ou non autorisée" });

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return res.json({ success: true, message: "Marquée comme lue", data: updated });
  } catch (err) {
    console.error("Erreur markAsRead:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// === SUPPRIMER UNE NOTIFICATION ===
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notificationId = Number(req.params.id);

    const notif = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        OR: [{ userId }, { parking: { userId } }],
      },
    });

    if (!notif)
      return res
        .status(404)
        .json({ error: "Notification non trouvée ou non autorisée" });

    await prisma.notification.delete({ where: { id: notificationId } });

    return res.json({ success: true, message: "Supprimée avec succès" });
  } catch (err) {
    console.error("Erreur deleteNotification:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};