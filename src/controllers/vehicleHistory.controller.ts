import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ➕ CREATE VehicleHistory
export const createVehicleHistory = async (req: Request, res: Response) => {
  const { vehicleId, changes } = req.body;

  if (!vehicleId || !changes) {
    return res.status(400).json({ error: 'vehicleId et changes sont requis' });
  }

  try {
    const newHistory = await prisma.vehicleHistory.create({
      data: {
        vehicleId,
        changes,
      },
    });
    res.status(201).json({ message: 'Historique créé', history: newHistory });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur lors de la création', details: error.message });
  }
};

// 📥 GET all
export const getAllVehicleHistories = async (_req: Request, res: Response) => {
  try {
    const histories = await prisma.vehicleHistory.findMany({
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(histories);
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération', details: error.message });
  }
};

// 🔍 GET by ID
export const getVehicleHistoryById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const history = await prisma.vehicleHistory.findUnique({
      where: { id: parseInt(id) },
      include: { vehicle: true },
    });

    if (!history) return res.status(404).json({ error: 'Historique non trouvé' });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération', details: error.message });
  }
};

// ✏️ UPDATE
export const updateVehicleHistory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { changes } = req.body;

  try {
    const updated = await prisma.vehicleHistory.update({
      where: { id: parseInt(id) },
      data: { changes },
    });
    res.json({ message: 'Historique mis à jour', history: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour', details: error.message });
  }
};

// 🗑️ DELETE
export const deleteVehicleHistory = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.vehicleHistory.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Historique supprimé avec succès' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur lors de la suppression', details: error.message });
  }
};
