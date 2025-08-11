import { Request, Response } from 'express';
import { PrismaClient, NotificationType } from '@prisma/client';
import { z } from 'zod';

console.log('DEBUG NotificationType:', NotificationType);

const prisma = new PrismaClient();

// Schéma de validation
const createNotificationSchema = z.object({
  title: z.string().min(3).max(100),
  message: z.string().min(5).max(500),
  type: z.nativeEnum(NotificationType),
  userId: z.number().optional(),
  parkingId: z.number().optional()
});

// CREATE NOTIFICATION
export const createNotification = async (req: Request, res: Response) => {
  try {
    const validatedData = createNotificationSchema.parse(req.body);
    const { userId, parkingId } = validatedData;

    // Validation: doit avoir soit userId soit parkingId, mais pas les deux
    if ((userId && parkingId) || (!userId && !parkingId)) {
      return res.status(400).json({
        error: "La notification doit être associée soit à un utilisateur (userId), soit à un parking (parkingId)"
      });
    }

    const notification = await prisma.notification.create({
      data: {
        title: validatedData.title,
        message: validatedData.message,
        type: validatedData.type,
        userId,
        parkingId
      },
      include: {
        user: { select: { id: true, email: true } },
        parking: { select: { id: true, name: true } }
      }
    });

    return res.status(201).json({
      success: true,
      data: notification
    });

  } catch (err) {
    console.error("Erreur création notification:", err);
    return res.status(500).json({
      error: "Erreur serveur",
      details: process.env.NODE_ENV === 'development' ? err : undefined
    });
  }
};

// GET ALL NOTIFICATIONS (avec filtres)
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { userId, parkingId, read, type } = req.query;

    const notifications = await prisma.notification.findMany({
      where: {
        ...(userId && { userId: Number(userId) }),
        ...(parkingId && { parkingId: Number(parkingId) }),
        ...(read !== undefined && { read: read === 'true' }),
        ...(type && { type: type as NotificationType })
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true } },
        parking: { select: { id: true, name: true } }
      }
    });

    return res.json({ success: true, data: notifications });

  } catch (err) {
    console.error("Erreur récupération notifications:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// GET NOTIFICATION BY ID
export const getNotificationById = async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        user: { select: { id: true, email: true } },
        parking: { select: { id: true, name: true } }
      }
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification non trouvée" });
    }

    return res.json({ success: true, data: notification });

  } catch (err) {
    console.error("Erreur récupération notification:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// MARK AS READ
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: Number(req.params.id) },
      data: { read: true }
    });

    return res.json({ 
      success: true, 
      message: "Notification marquée comme lue",
      data: notification 
    });

  } catch (err) {
    console.error("Erreur mise à jour notification:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// DELETE NOTIFICATION
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    await prisma.notification.delete({
      where: { id: Number(req.params.id) }
    });

    return res.json({ 
      success: true, 
      message: "Notification supprimée avec succès" 
    });

  } catch (err) {
    console.error("Erreur suppression notification:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};