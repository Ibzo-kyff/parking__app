import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { PrismaClient, Status, Role } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: JwtPayload & {
    id: number;
    email: string;
    role: Role;           // On garde Role (enum)
    nom?: string;
    prenom?: string;
    phone?: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Accès non autorisé, token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as {
      id: number;
      email: string;
      role: string;        // ← jwt retourne un string
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,        // C'est un enum Role ici
        nom: true,
        prenom: true,
        phone: true,
        status: true,
      }
    });

    if (!user) {
      return res.status(403).json({ message: 'Utilisateur non trouvé.' });
    }

    if (user.status === Status.PENDING) {
      return res.status(403).json({ message: 'Compte en attente d\'approbation.' });
    }

    // On assigne correctement avec le bon type Role
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as Role,        // Cast explicite
      nom: user.nom || undefined,
      prenom: user.prenom || undefined,
      phone: user.phone || undefined,
    };

    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: 'Token invalide ou expiré.' });
  }
};