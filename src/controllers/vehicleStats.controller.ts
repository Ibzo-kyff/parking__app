// src/controllers/vehicleStatsController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CREATE vehicle stats (auto when vehicle created, but we can expose it too)
export const createVehicleStats = async (req: Request, res: Response) => {
  const { vehicleId } = req.body;

  try {
    const existingStats = await prisma.vehicleStats.findUnique({ where: { vehicleId } });
    if (existingStats) {
      return res.status(400).json({ error: 'Les statistiques existent déjà pour ce véhicule.' });
    }

    const stats = await prisma.vehicleStats.create({
      data: {
        vehicleId,
        vues: 0,
        reservations: 0
      }
    });

    return res.status(201).json({ message: 'Statistiques créées', stats });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erreur lors de la création des statistiques', details: error.message });
  }
};

// GET vehicle stats by vehicleId
export const getVehicleStats = async (req: Request, res: Response) => {
  const { vehicleId } = req.params;

  try {
    const stats = await prisma.vehicleStats.findUnique({
      where: { vehicleId: parseInt(vehicleId) },
    });

    if (!stats) {
      return res.status(404).json({ error: 'Statistiques non trouvées pour ce véhicule.' });
    }

    return res.json(stats);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des statistiques', details: error.message });
  }
};

// UPDATE vehicle stats manually (e.g., for testing)
export const updateVehicleStats = async (req: Request, res: Response) => {
  const { vehicleId } = req.params;
  const { vues, reservations } = req.body;

  try {
    const updated = await prisma.vehicleStats.update({
      where: { vehicleId: parseInt(vehicleId) },
      data: {
        vues,
        reservations
      }
    });
    return res.json({ message: 'Statistiques mises à jour', stats: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erreur lors de la mise à jour des statistiques', details: error.message });
  }
};

// DELETE vehicle stats
export const deleteVehicleStats = async (req: Request, res: Response) => {
  const { vehicleId } = req.params;

  try {
    await prisma.vehicleStats.delete({ where: { vehicleId: parseInt(vehicleId) } });
    return res.json({ message: 'Statistiques supprimées avec succès' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erreur lors de la suppression', details: error.message });
  }
};
