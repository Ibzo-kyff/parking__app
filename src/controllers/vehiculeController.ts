import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

// CREATE VEHICULE
export const createVehicule = async (req: Request, res: Response) => {
  try {
    const {
      userOwnerId,
      parkingId,
      marque,
      model,
      prix,
      description,
      garantie,
      dureeGarantie,
      chauffeur,
      assurance,
      dureeAssurance,
      carteGrise,
      vignette,
      fuelType,
      mileage
    } = req.body;

    // multer place les fichiers dans req.files
    const photos = (req.files as Express.Multer.File[]).map(
      f => `/uploads/${f.filename}`
    );

    if ((userOwnerId && parkingId) || (!userOwnerId && !parkingId)) {
      return res.status(400).json({
        error: "Un véhicule doit appartenir soit à un utilisateur (userOwnerId), soit à un parking (parkingId), mais pas aux deux ou aucun."
      });
    }

    const vehicule = await prisma.vehicle.create({
      data: {
        marque,
        model,
        prix: Number(prix),
        description,
        fuelType,
        mileage: mileage ? Number(mileage) : null,
        garantie: garantie === "true",
        dureeGarantie: dureeGarantie ? Number(dureeGarantie) : null,
        chauffeur: chauffeur === "true",
        assurance,
        dureeAssurance: dureeAssurance ? Number(dureeAssurance) : null,
        carteGrise,
        vignette,
        photos,
        userOwnerId: userOwnerId ? Number(userOwnerId) : undefined,
        parkingId: parkingId ? Number(parkingId) : undefined,
      }
    });

    return res.status(201).json({ message: "Véhicule enregistré avec succès", vehicule });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur lors de la création du véhicule" });
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
// GET VEHICLES FOR PARKING USER WITH STATS
export const getParkingUserVehicles = async (req: AuthRequest, res: Response) => {
  try {
    // Vérifier que l'utilisateur est authentifié et a le rôle PARKING
    if (!req.user || req.user.role !== Role.PARKING) {
      return res.status(403).json({ 
        error: 'Accès refusé. Seuls les utilisateurs PARKING peuvent accéder à cette ressource.' 
      });
    }

    // Récupérer l'ID de l'utilisateur connecté
    const userId = req.user.id;

    // Trouver le parking associé à cet utilisateur
    const parking = await prisma.parking.findFirst({
      where: { userId: userId },
      select: { id: true, name: true }
    });

    if (!parking) {
      return res.status(404).json({ 
        error: 'Aucun parking trouvé pour cet utilisateur.' 
      });
    }

    // Récupérer les véhicules du parking avec les relations nécessaires
    const vehicles = await prisma.vehicle.findMany({
      where: { 
        parkingId: parking.id 
      },
      include: {
        // Inclure les informations du propriétaire si nécessaire
        userOwner: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            phone: true
          }
        },
        // Inclure les statistiques de base
        stats: {
          select: {
            vues: true,
            reservations: true
          }
        },
        // Inclure les favoris pour les statistiques
        favorites: {
          select: {
            id: true,
            userId: true
          }
        },
        // Inclure les réservations pour les statistiques détaillées
        reservations: {
          select: {
            id: true,
            type: true,
            dateDebut: true,
            dateFin: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculer les statistiques agrégées basées sur le status des véhicules
    const stats = {
      total: vehicles.length,
      vendus: vehicles.filter(v => v.status === 'ACHETE').length,
      reserves: vehicles.filter(v => v.status === 'EN_LOCATION').length,
      disponibles: vehicles.filter(v => v.status === 'DISPONIBLE').length,
      enMaintenance: vehicles.filter(v => v.status === 'EN_MAINTENANCE').length,
      indisponibles: vehicles.filter(v => v.status === 'INDISPONIBLE').length,
      totalVues: vehicles.reduce((sum, vehicle) => sum + (vehicle.stats?.vues || 0), 0),
      totalReservations: vehicles.reduce((sum, vehicle) => sum + (vehicle.stats?.reservations || 0), 0),
      totalFavoris: vehicles.reduce((sum, vehicle) => sum + vehicle.favorites.length, 0)
    };

    // Formater les véhicules avec des statistiques supplémentaires
    const formattedVehicles = vehicles.map(vehicle => ({
      ...vehicle,
      stats: {
        vues: vehicle.stats?.vues || 0,
        reservations: vehicle.stats?.reservations || 0,
        favoris: vehicle.favorites.length,
        reservationsActives: vehicle.reservations.filter(r => 
          new Date(r.dateFin) > new Date()
        ).length
      }
    }));

    return res.json({
      parking: {
        id: parking.id,
        name: parking.name
      },
      statistics: stats,
      vehicles: formattedVehicles
    });

  } catch (err) {
    console.error('Erreur lors de la récupération des véhicules du parking:', err);
    return res.status(500).json({ 
      error: 'Erreur lors de la récupération des véhicules du parking',
      details: err instanceof Error ? err.message : 'Erreur inconnue'
    });
  }
};
// Optionnel : Ajouter une route pour les statistiques détaillées
export const getParkingStats = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== Role.PARKING) {
      return res.status(403).json({ 
        error: 'Accès refusé' 
      });
    }

    const userId = req.user.id;
    const parking = await prisma.parking.findFirst({
      where: { userId: userId },
      select: { id: true }
    });

    if (!parking) {
      return res.status(404).json({ error: 'Parking non trouvé' });
    }

    // Statistiques mensuelles, etc.
    const monthlyStats = await prisma.vehicle.groupBy({
      by: ['status'],
      where: { parkingId: parking.id },
      _count: { id: true }
    });

    return res.json({ monthlyStats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
