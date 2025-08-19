import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// CREATE VEHICULE
export const createVehicule = async (req: Request, res: Response) => {
  const {
    userOwnerId,
    parkingId,
    marque,
    model,
    prix,
    description,
    photos = [],
    garantie = false,
    dureeGarantie,
    documents = [],
    chauffeur = false, // Valeur par défaut true
    assurance,
    dureeAssurance,
    carteGrise,
    vignette,
    fuelType,
    mileage
  } = req.body;

  // 🚫 Un seul des deux doit être fourni
  if ((userOwnerId && parkingId) || (!userOwnerId && !parkingId)) {
    return res.status(400).json({
      error: 'Un véhicule doit appartenir soit à un utilisateur (userOwnerId), soit à un parking (parkingId), mais pas aux deux ou aucun.'
    });
  }

  try {
    // Vérification de l'existence du client
    if (userOwnerId) {
      const user = await prisma.user.findUnique({ where: { id: userOwnerId } });
      if (!user || user.role !== Role.CLIENT) {
        return res.status(400).json({ error: 'Utilisateur invalide ou non client.' });
      }
    }

    // Vérification du parking
    if (parkingId) {
      const parking = await prisma.parking.findUnique({ where: { id: parkingId } });
      if (!parking) {
        return res.status(400).json({ error: 'Parking non trouvé.' });
      }
    }

    // Construction dynamique de l'objet data
    const vehiculeData: any = {
        marque,
        model,
        prix: Number(prix),
        description,
        photos,
        garantie,
        dureeGarantie: dureeGarantie ? Number(dureeGarantie) : null,
        documents,
        chauffeur, // Utilise la valeur fournie ou true par défaut
        assurance,
        dureeAssurance: dureeAssurance ? Number(dureeAssurance) : null,
        carteGrise,
        vignette,
        fuelType,
        mileage: mileage ? Number(mileage) : null,
    };

    if (userOwnerId) vehiculeData.userOwnerId = userOwnerId;
    if (parkingId) vehiculeData.parkingId = parkingId;

    // Création du véhicule
    const vehicule = await prisma.vehicle.create({
      data: vehiculeData
    });

    return res.status(201).json({ message: 'Véhicule enregistré avec succès', vehicule });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      error: 'Erreur lors de la création du véhicule',
      details: err?.message || err
    });
  }
};

// GET ALL VEHICULES WITH FILTERS
export const getAllVehicules = async (req: Request, res: Response) => {
  const {
    marque,
    model,
    minPrix,
    maxPrix,
    fuelType,
    maxMileage,
    withChauffeur,
    withGarantie,
    parkingId,
    userOwnerId,
    status
  } = req.query;

  try {
    const where: any = {};

    if (marque) {
      where.marque = { contains: marque as string, mode: 'insensitive' };
    }

    if (model) {
      where.model = { contains: model as string, mode: 'insensitive' };
    }

    if (minPrix || maxPrix) {
      where.prix = {};
      if (minPrix) where.prix.gte = Number(minPrix);
      if (maxPrix) where.prix.lte = Number(maxPrix);
    }

    if (fuelType) {
      where.fuelType = fuelType as string;
    }

    if (maxMileage) {
      where.mileage = { lte: Number(maxMileage) };
    }

    if (withChauffeur !== undefined) {
      where.chauffeur = withChauffeur === 'true';
    }

    if (withGarantie !== undefined) {
      where.garantie = withGarantie === 'true';
    }

    if (parkingId) {
      where.parkingId = Number(parkingId);
    }

    if (userOwnerId) {
      where.userOwnerId = Number(userOwnerId);
    }

    if (status) {
      where.status = status as string;
    }

    const vehicules = await prisma.vehicle.findMany({
      where,
      include: {
        parking: true,
        userOwner: true,
        stats: true,
        favorites: true
      }
    });

    return res.json(vehicules);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des véhicules' });
  }
};

// GET VEHICULE BY ID
export const getVehiculeById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const vehicule = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) },
      include: {
        parking: true,
        userOwner: true,
        stats: true,
        favorites: true
      }
    });

    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    return res.json(vehicule);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération du véhicule' });
  }
};

// UPDATE VEHICULE
export const updateVehicule = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    marque,
    prix,
    description,
    photos,
    garantie,
    dureeGarantie,
    documents,
    chauffeur,
    assurance,
    dureeAssurance,
    carteGrise,
    vignette,
    status
  } = req.body;

  try {
    const updatedVehicule = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: {
        marque,
        prix,
        description,
        photos,
        garantie,
        dureeGarantie,
        documents,
        chauffeur,
        assurance,
        dureeAssurance,
        carteGrise,
        vignette,
        status
      }
    });

    return res.json({ message: 'Véhicule mis à jour', vehicule: updatedVehicule });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du véhicule' });
  }
};

// DELETE VEHICULE
export const deleteVehicule = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.vehicle.delete({
      where: { id: parseInt(id) }
    });

    return res.json({ message: 'Véhicule supprimé avec succès' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la suppression du véhicule' });
  }
};

// GET DISTINCT MARQUES
export const getDistinctMarques = async (_req: Request, res: Response) => {
  try {
    const marques = await prisma.vehicle.findMany({
      select: { marque: true },
      distinct: ['marque']
    });
    return res.json(marques.map((v) => v.marque));
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des marques' });
  }
};

// GET DISTINCT MODELS
export const getDistinctModels = async (_req: Request, res: Response) => {
  try {
    const models = await prisma.vehicle.findMany({
      select: { model: true },
      distinct: ['model']
    });
    return res.json(models.map((v) => v.model));
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des modèles' });
  }
};

// GET RECENT PARKINGS IMAGES (LAST 4 ADDED PARKINGS WITH THEIR PHOTOS/LOGOS)
export const getRecentParkings = async (_req: Request, res: Response) => {
  try {
    const parkings = await prisma.parking.findMany({
      orderBy: { createdAt: 'desc' }, // Assumes parking has a createdAt field
      take: 4,
      select: {
        id: true,
        logo: true // Assumes parking has a 'photos' field similar to vehicles; adjust if it's 'logo' or another field
      }
    });
    return res.json(parkings);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des parkings récents' });
  }
};