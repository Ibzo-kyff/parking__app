import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Status } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string }; // Typage précis basé sur le payload
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Accès non autorisé, token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as { id: number; email: string; role: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(403).json({ message: 'Utilisateur non trouvé.' });
    }

    if (user.status === Status.PENDING) {
      return res.status(403).json({ message: 'Compte en attente d\'approbation.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token invalide ou expiré.' });
  }
};