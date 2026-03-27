// src/routes/adminRouter.ts
import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';  

const router = express.Router();

// Middleware qui vérifie que l'utilisateur est ADMIN
const isAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
};

// ====================== ROUTE DES LOGS ======================
router.get('/logs', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, entity, action, search } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { nom: true, prenom: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    });

    const total = await prisma.auditLog.count({ where });

    res.json({
      success: true,
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la récupération des logs' });
  }
});

export default router;