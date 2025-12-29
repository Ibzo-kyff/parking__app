import { Request, Response } from 'express';
import { pusher } from '../index';

interface AuthRequest extends Request {
  user?: { id: number };
}

export const pusherAuth = (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;

    const authResponse = pusher.authorizeChannel(
      socketId,
      channel,
      { user_id: String(req.user.id) }
    );

    res.send(authResponse);
  } catch (error) {
    console.error('Erreur auth pusher:', error);
    res.status(403).json({ message: 'Pusher auth failed' });
  }
};
