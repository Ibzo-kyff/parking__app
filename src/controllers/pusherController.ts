import { Request, Response } from 'express';
import { pusher } from '../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number; nom?: string; prenom?: string }; // Ajout nom/prenom pour user_info
}

export const pusherAuth = (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;

    let authResponse;
    if (channel.startsWith('presence-')) {
      // Pour channels de présence, ajouter user_info
      const userInfo = {
        user_id: String(req.user.id),
        user_info: {
          name: `${req.user.nom || ''} ${req.user.prenom || ''}`.trim() || 'Utilisateur anonyme',
        },
      };
      authResponse = pusher.authorizeChannel(socketId, channel, userInfo);
    } else {
      // Pour autres channels (privés)
      authResponse = pusher.authorizeChannel(socketId, channel, { user_id: String(req.user.id) });
    }

    res.send(authResponse);
  } catch (error) {
    console.error('Erreur auth pusher:', error);
    res.status(403).json({ message: 'Pusher auth failed' });
  }
};

export const registerPushToken = async (req: AuthRequest, res: Response) => {
  const { token } = req.body;

  if (!req.user?.id) {
    return res.status(401).json({ message: 'Non authentifié' });
  }

  if (!token) {
    return res.status(400).json({ message: 'Token manquant' });
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { expoPushToken: token },
  });

  res.json({ success: true });
};

export const pusherWebhook = async (req: Request, res: Response) => {
  try {
    // Valider le webhook avec Pusher
    const webhookRequest = { headers: req.headers, rawBody: (req as any).rawBody ?? JSON.stringify(req.body) };
    const webhook = pusher.webhook(webhookRequest);
    if (!webhook.isValid()) {
      return res.status(400).json({ message: 'Webhook invalide' });
    }

    // Traiter les événements (utiliser une boucle sync avec await pour éviter races)
    const events = webhook.getEvents();
    for (const event of events) {
      console.log(`Webhook event reçu: ${event.name}`); // Log pour debug

      if (event.name === 'member_added') {
        const userId = parseInt((event as any).user_id);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) continue;

        const wasOffline = user.connectionCount === 0;
        await prisma.user.update({
          where: { id: userId },
          data: {
            isOnline: true,
            socketId: (event as any).socket_id,
            connectionCount: { increment: 1 },
            lastSeen: null,
          },
        });

        // Diffuser seulement si c'était la première connexion
        if (wasOffline) {
          await pusher.trigger('presence-online', 'user-online', { userId });
        }
      } else if (event.name === 'member_removed') {
        const userId = parseInt((event as any).user_id);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) continue;

        const newCount = Math.max(0, user.connectionCount - 1); // Éviter négatif
        const nowOffline = newCount === 0;

        await prisma.user.update({
          where: { id: userId },
          data: {
            connectionCount: newCount,
            isOnline: !nowOffline,
            lastSeen: nowOffline ? new Date() : user.lastSeen,
            socketId: nowOffline ? null : user.socketId,
          },
        });

        // Diffuser seulement si c'est la dernière déconnexion
        if (nowOffline) {
          await pusher.trigger('presence-online', 'user-offline', { userId, lastSeen: new Date() });
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Erreur webhook Pusher:', error);
    res.status(500).json({ message: 'Erreur traitement webhook' });
  }
};