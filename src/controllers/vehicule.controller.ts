import { Request, Response } from 'express';
import { PrismaClient, Role, Prisma } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const vehiculeSchema = z.object({
  userOwnerId: z.number().optional(),
  parkingId: z.number().optional(),
  marque: z.string().min(1, 'La marque est requise'),
  prix: z.number().nonnegative('Le prix doit être positif'),
  description: z.string().optional(),
  photos: z.array(z.string()).optional(),
  garantie: z.boolean().optional(),
  dureeGarantie: z.number().optional(),
  documents: z.array(z.string()).optional(),
  chauffeur: z.boolean().optional(),
  assurance: z.string().optional(),
  dureeAssurance: z.number().optional(),
  carteGrise: z.string().optional(),
  vignette: z.string().optional(),
  status: z.enum(['DISPONIBLE', 'EN_LOCATION', 'ACHETE', 'EN_MAINTENANCE']).optional(),
});

export const createVehicule = async (req: Request, res: Response) => {
  try {
    const validatedData = vehiculeSchema.parse(req.body);

    if ((validatedData.userOwnerId && validatedData.parkingId) || (!validatedData.userOwnerId && !validatedData.parkingId)) {
      return res.status(400).json({ error: 'Un véhicule doit appartenir soit à un utilisateur (userOwnerId), soit à un parking (parkingId), mais pas aux deux ou aucun.' });
    }

    if (validatedData.userOwnerId) {
      const user = await prisma.user.findUnique({ where: { id: validatedData.userOwnerId } });
      if (!user || user.role !== Role.CLIENT) {
        return res.status(400).json({ error: 'Utilisateur invalide ou non client.' });
      }
    }

    if (validatedData.parkingId) {
      const parking = await prisma.parking.findUnique({ where: { id: validatedData.parkingId } });
      if (!parking) {
        return res.status(400).json({ error: 'Parking non trouvé.' });
      }
    }

    const data: Prisma.VehicleUncheckedCreateInput = {
      marque: validatedData.marque,
      prix: validatedData.prix,
      userOwnerId: validatedData.userOwnerId,
      parkingId: validatedData.parkingId,
      description: validatedData.description ?? '',
      photos: validatedData.photos ?? [],
      garantie: validatedData.garantie ?? false,
      dureeGarantie: validatedData.dureeGarantie,
      documents: validatedData.documents ?? [],
      chauffeur: validatedData.chauffeur ?? false,
      assurance: validatedData.assurance,
      carteGrise: validatedData.carteGrise,
      dureeAssurance: validatedData.dureeAssurance,
      vignette: validatedData.vignette,
      status: validatedData.status ?? 'DISPONIBLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const vehicule = await prisma.vehicle.create({ data });
    return res.status(201).json({ message: 'Véhicule enregistré avec succès', vehicule });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation échouée', details: err.errors });
    }
    return res.status(500).json({ error: 'Erreur lors de la création du véhicule', details: err.message });
  }
};

export const getAllVehicules = async (_req: Request, res: Response) => {
  try {
    const vehicules = await prisma.vehicle.findMany({
      include: { userOwner: true, parking: true },
    });
    return res.status(200).json(vehicules);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des véhicules', details: err.message });
  }
};

export const getVehiculeById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const vehicule = await prisma.vehicle.findUnique({
      where: { id },
      include: { userOwner: true, parking: true, favorites: true, stats: true, history: true },
    });
    if (!vehicule) return res.status(404).json({ error: 'Véhicule non trouvé' });
    return res.status(200).json(vehicule);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erreur lors de la récupération du véhicule', details: err.message });
  }
};

export const updateVehicule = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updateSchema = vehiculeSchema.partial();
    const validatedData = updateSchema.parse(req.body);

    const dataToUpdate = Object.fromEntries(Object.entries(validatedData).filter(([_, val]) => val !== undefined));

    const updatedVehicule = await prisma.vehicle.update({ where: { id }, data: dataToUpdate });
    return res.status(200).json({ message: 'Véhicule mis à jour', vehicule: updatedVehicule });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation échouée', details: err.errors });
    }
    return res.status(500).json({ error: 'Erreur de mise à jour', details: err.message });
  }
};

export const deleteVehicule = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.vehicle.delete({ where: { id } });
    return res.status(200).json({ message: 'Véhicule supprimé avec succès' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erreur lors de la suppression', details: err.message });
  }
};

export const addToFavorites = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { vehicleId } = req.body;

  try {
    const favorite = await prisma.favorite.create({
      data: { userId, vehicleId },
    });
    return res.status(201).json({ message: 'Ajouté aux favoris', favorite });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Déjà dans les favoris' });
    }
    return res.status(500).json({ error: 'Erreur ajout favoris', details: err.message });
  }
};

export const incrementViewCount = async (req: Request, res: Response) => {
  const vehicleId = parseInt(req.params.id);
  try {
    const stat = await prisma.vehicleStats.upsert({
      where: { vehicleId },
      create: { vehicleId, vues: 1 },
      update: { vues: { increment: 1 } },
    });
    return res.status(200).json(stat);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erreur lors de l’incrémentation des vues' });
  }
};

export const createVehicleHistory = async (req: Request, res: Response) => {
  const { vehicleId, changes } = req.body;
  if (!vehicleId || !changes) {
    return res.status(400).json({ error: 'vehicleId et changes sont requis' });
  }
  try {
    const history = await prisma.vehicleHistory.create({ data: { vehicleId, changes } });
    return res.status(201).json({ message: 'Historique enregistré', history });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erreur création historique', details: err.message });
  }
};

export const getStatsByVehicleId = async (req: Request, res: Response) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const stats = await prisma.vehicleStats.findUnique({ where: { vehicleId } });
    if (!stats) {
      return res.status(404).json({ error: 'Aucune statistique trouvée' });
    }
    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erreur récupération statistiques', details: err.message });
  }
};
