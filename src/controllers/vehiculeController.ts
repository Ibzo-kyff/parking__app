import { Request, Response } from 'express';
import { PrismaClient, Role, ReservationType, ReservationStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';
import { put, del } from '@vercel/blob';

const prisma = new PrismaClient();

// Fonction utilitaire pour normaliser et gérer les marques
const findOrCreateMarque = async (marqueName: string) => {
  if (!marqueName || typeof marqueName !== 'string' || marqueName.trim() === '') {
    throw new Error('Le nom de la marque est invalide');
  }

  const normalizedMarque = marqueName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const existingMarque = await prisma.marque.findFirst({
    where: {
      OR: [
        { name: normalizedMarque },
        { name: { equals: marqueName, mode: 'insensitive' } },
        { name: { equals: normalizedMarque, mode: 'insensitive' } },
      ],
    },
  });

  if (existingMarque) {
    return existingMarque;
  }

  try {
    return await prisma.marque.create({
      data: { name: normalizedMarque },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      const marque = await prisma.marque.findUnique({
        where: { name: normalizedMarque },
      });
      if (marque) return marque;
    }
    throw error;
  }
};

// CREATE VEHICULE
export const createVehicule = async (req: Request, res: Response) => {
  try {
    const {
      userOwnerId,
      parkingId,
      marque,
      model,
      year,
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
      mileage,
      forSale,
      forRent,
      transmission,
    } = req.body;

    if (!marque || !model || !prix) {
      return res.status(400).json({ error: 'Les champs marque, modèle et prix sont obligatoires.' });
    }

    if (typeof marque !== 'string' || marque.trim() === '') {
      return res.status(400).json({ error: 'La marque doit être une chaîne de caractères non vide.' });
    }

    if ((userOwnerId && parkingId) || (!userOwnerId && !parkingId)) {
      return res.status(400).json({
        error: 'Un véhicule doit appartenir soit à un utilisateur, soit à un parking.',
      });
    }

    const parsedGarantie = garantie === 'true';
    const parsedChauffeur = chauffeur === 'true';
    const parsedAssurance = assurance === 'true';
    const parsedCarteGrise = carteGrise === 'true';
    const parsedVignette = vignette === 'true';
    const parsedForSale = forSale !== undefined ? forSale === 'true' : true;
    const parsedForRent = forRent !== undefined ? forRent === 'true' : true;

    const parsedPrix = Number(prix);
    if (isNaN(parsedPrix)) return res.status(400).json({ error: 'Le prix doit être un nombre valide.' });

    const parsedYear = year ? Number(year) : null;
    if (year && isNaN(parsedYear!)) return res.status(400).json({ error: "L'année doit être un nombre valide." });

    const parsedDureeGarantie = dureeGarantie ? Number(dureeGarantie) : null;
    if (parsedGarantie && parsedDureeGarantie === null) {
      return res.status(400).json({ error: 'La durée de garantie est obligatoire si la garantie est activée.' });
    }

    const parsedDureeAssurance = dureeAssurance ? Number(dureeAssurance) : null;
    if (parsedAssurance && parsedDureeAssurance === null) {
      return res.status(400).json({ error: "La durée d'assurance est obligatoire si l'assurance est activée." });
    }

    const parsedMileage = mileage ? Number(mileage) : null;

    const parsedTransmission = transmission ? transmission.toUpperCase() : 'MANUAL';
    if (!['MANUAL', 'AUTOMATIC'].includes(parsedTransmission)) {
      return res.status(400).json({ error: 'La transmission doit être MANUAL ou AUTOMATIC.' });
    }

    const marqueEntity = await findOrCreateMarque(marque);

    const files = req.files as Express.Multer.File[];
    const photos: string[] = [];
    if (files?.length > 0) {
      for (const file of files) {
        const newFilename = `vehicles/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname.match(/\.[0-9a-z]+$/i)?.[0] || '.jpg'}`;
        const result = await put(newFilename, file.buffer, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN!,
        });
        photos.push(result.url);
      }
    }

    const vehicule = await prisma.vehicle.create({
      data: {
        marqueId: marqueEntity.id,
        model,
        year: parsedYear,
        prix: parsedPrix,
        description: description || '',
        fuelType,
        mileage: parsedMileage,
        garantie: parsedGarantie,
        dureeGarantie: parsedDureeGarantie,
        chauffeur: parsedChauffeur,
        assurance: parsedAssurance,
        dureeAssurance: parsedDureeAssurance,
        carteGrise: parsedCarteGrise,
        vignette: parsedVignette,
        forSale: parsedForSale,
        forRent: parsedForRent,
        transmission: parsedTransmission as 'MANUAL' | 'AUTOMATIC',
        photos,
        userOwnerId: userOwnerId ? Number(userOwnerId) : undefined,
        parkingId: parkingId ? Number(parkingId) : undefined,
      },
    });

    return res.status(201).json({ message: 'Véhicule enregistré avec succès', vehicule });
  } catch (err: any) {
    console.error('Erreur création véhicule:', err);
    return res.status(500).json({
      error: 'Erreur lors de la création du véhicule',
      details: err.message || 'Erreur inconnue',
    });
  }
};

// UPDATE VEHICULE
export const updateVehicule = async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body;

  try {
    const vehicule = await prisma.vehicle.findUnique({ where: { id: parseInt(id) } });
    if (!vehicule) return res.status(404).json({ error: 'Véhicule non trouvé' });

    let marqueId = vehicule.marqueId;
    if (body.marque) {
      const marqueEntity = await findOrCreateMarque(body.marque);
      marqueId = marqueEntity.id;
    }

    let photos = vehicule.photos;
    const files = req.files as Express.Multer.File[];
    if (files?.length > 0) {
      if (photos.length > 0) {
        for (const photo of photos) {
          try {
            const url = new URL(photo);
            await del(url.pathname.slice(1));
          } catch {}
        }
      }
      photos = [];
      for (const file of files) {
        const newFilename = `vehicles/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname.match(/\.[0-9a-z]+$/i)?.[0] || '.jpg'}`;
        const result = await put(newFilename, file.buffer, { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN! });
        photos.push(result.url);
      }
    }

    const updatedVehicule = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: {
        marqueId,
        model: body.model,
        year: body.year ? Number(body.year) : undefined,
        prix: body.prix ? Number(body.prix) : undefined,
        description: body.description,
        fuelType: body.fuelType,
        mileage: body.mileage ? Number(body.mileage) : undefined,
        garantie: body.garantie !== undefined ? body.garantie === 'true' : undefined,
        dureeGarantie: body.dureeGarantie ? Number(body.dureeGarantie) : undefined,
        chauffeur: body.chauffeur !== undefined ? body.chauffeur === 'true' : undefined,
        assurance: body.assurance !== undefined ? body.assurance === 'true' : undefined,
        dureeAssurance: body.dureeAssurance ? Number(body.dureeAssurance) : undefined,
        carteGrise: body.carteGrise !== undefined ? body.carteGrise === 'true' : undefined,
        vignette: body.vignette !== undefined ? body.vignette === 'true' : undefined,
        forSale: body.forSale !== undefined ? body.forSale === 'true' : undefined,
        forRent: body.forRent !== undefined ? body.forRent === 'true' : undefined,
        status: body.status,
        transmission: body.transmission ? (body.transmission.toUpperCase() as 'MANUAL' | 'AUTOMATIC') : undefined,
        photos,
      },
    });

    return res.json({ message: 'Véhicule mis à jour', vehicule: updatedVehicule });
  } catch (err: any) {
    console.error('Erreur mise à jour véhicule:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour', details: err.message });
  }
};

// GET ALL VEHICULES (PUBLIC) - Véhicules disponibles à l'achat ou à la location
export const getAllVehicules = async (req: Request, res: Response) => {
  const query = req.query;

  try {
    const where: any = {
      OR: [
        { forSale: true },
        { forRent: true }
      ],
      NOT: {
        reservations: {
          some: {
            type: ReservationType.ACHAT,
            status: { in: [ReservationStatus.PENDING, ReservationStatus.ACCEPTED] },
          },
        },
      },
    };

    if (query.marque) where.marqueRef = { name: { contains: query.marque as string, mode: 'insensitive' } };
    if (query.model) where.model = { contains: query.model as string, mode: 'insensitive' };
    if (query.minPrix || query.maxPrix) {
      where.prix = {};
      if (query.minPrix) where.prix.gte = Number(query.minPrix);
      if (query.maxPrix) where.prix.lte = Number(query.maxPrix);
    }
    if (query.fuelType) where.fuelType = query.fuelType as string;
    if (query.maxMileage) where.mileage = { lte: Number(query.maxMileage) };
    if (query.withChauffeur !== undefined) where.chauffeur = query.withChauffeur === 'true';
    if (query.withGarantie !== undefined) where.garantie = query.withGarantie === 'true';
    if (query.parkingId) where.parkingId = Number(query.parkingId);
    if (query.userOwnerId) where.userOwnerId = Number(query.userOwnerId);
    if (query.status) where.status = query.status as string;
    if (query.forSale !== undefined) where.forSale = query.forSale === 'true';
    if (query.forRent !== undefined) where.forRent = query.forRent === 'true';
    if (query.transmission) where.transmission = query.transmission as string;

    const vehicules = await prisma.vehicle.findMany({
      where,
      include: {
        parking: true,
        userOwner: true,
        stats: true,
        favorites: true,
        marqueRef: true,
      },
    });

    return res.json(vehicules);
  } catch (err) {
    console.error('Erreur getAllVehicules:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des véhicules' });
  }
};

// GET ALL VEHICULES FOR ADMIN - Tous les véhicules sans restriction
export const getAllVehiculesAdmin = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== Role.ADMIN) {
    return res.status(403).json({ message: 'Accès refusé. Réservé aux administrateurs.' });
  }

  const query = req.query;

  try {
    const where: any = {};

    if (query.marque) where.marqueRef = { name: { contains: query.marque as string, mode: 'insensitive' } };
    if (query.model) where.model = { contains: query.model as string, mode: 'insensitive' };
    if (query.minPrix || query.maxPrix) {
      where.prix = {};
      if (query.minPrix) where.prix.gte = Number(query.minPrix);
      if (query.maxPrix) where.prix.lte = Number(query.maxPrix);
    }
    if (query.fuelType) where.fuelType = query.fuelType as string;
    if (query.maxMileage) where.mileage = { lte: Number(query.maxMileage) };
    if (query.withChauffeur !== undefined) where.chauffeur = query.withChauffeur === 'true';
    if (query.withGarantie !== undefined) where.garantie = query.withGarantie === 'true';
    if (query.parkingId) where.parkingId = Number(query.parkingId);
    if (query.userOwnerId) where.userOwnerId = Number(query.userOwnerId);
    if (query.status) where.status = query.status as string;
    if (query.forSale !== undefined) where.forSale = query.forSale === 'true';
    if (query.forRent !== undefined) where.forRent = query.forRent === 'true';
    if (query.transmission) where.transmission = query.transmission as string;

    const vehicules = await prisma.vehicle.findMany({
      where,
      include: {
        parking: true,
        userOwner: true,
        stats: true,
        favorites: true,
        marqueRef: true,
        reservations: {
          select: {
            id: true,
            type: true,
            status: true,
            user: { select: { nom: true, prenom: true, email: true } },
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(vehicules);
  } catch (err) {
    console.error('Erreur getAllVehiculesAdmin:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des véhicules (admin)' });
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
        favorites: true,
        marqueRef: true,
      },
    });
    if (!vehicule) return res.status(404).json({ error: 'Véhicule non trouvé' });
    return res.json(vehicule);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération du véhicule' });
  }
};

// DELETE VEHICULE
export const deleteVehicule = async (req: Request, res: Response) => {
  const { id } = req.params;
  const vehiculeId = parseInt(id, 10);
  if (isNaN(vehiculeId)) return res.status(400).json({ error: 'ID invalide' });

  try {
    const vehicule = await prisma.vehicle.findUnique({ where: { id: vehiculeId }, select: { photos: true } });
    if (!vehicule) return res.status(404).json({ error: 'Véhicule introuvable' });

    if (vehicule.photos.length > 0) {
      for (const photo of vehicule.photos) {
        try {
          const url = new URL(photo);
          await del(url.pathname.slice(1));
        } catch {}
      }
    }

    await prisma.reservation.deleteMany({ where: { vehicleId: vehiculeId } });
    await prisma.vehicleHistory.deleteMany({ where: { vehicleId: vehiculeId } });
    await prisma.favorite.deleteMany({ where: { vehicleId: vehiculeId } });
    await prisma.vehicleStats.deleteMany({ where: { vehicleId: vehiculeId } });

    await prisma.vehicle.delete({ where: { id: vehiculeId } });

    return res.json({ message: 'Véhicule supprimé avec succès' });
  } catch (err: any) {
    console.error('Erreur suppression:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression', details: err.message });
  }
};

// GET DISTINCT MARQUES
export const getDistinctMarques = async (_req: Request, res: Response) => {
  try {
    const marques = await prisma.marque.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return res.json(marques);
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

// GET RECENT PARKINGS IMAGES
export const getRecentParkings = async (_req: Request, res: Response) => {
  try {
    const parkings = await prisma.parking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        logo: true
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
        userOwner: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            phone: true
          }
        },
        stats: {
          select: {
            vues: true,
            reservations: true
          }
        },
        favorites: {
          select: {
            id: true,
            userId: true
          }
        },
        reservations: {
          select: {
            id: true,
            type: true,
            dateDebut: true,
            dateFin: true,
            status: true
          }
        },
        marqueRef: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculer les statistiques agrégées
    // Note: vendus et enLocation sont maintenant calculés dynamiquement via les reservations
    const now = new Date();
    const stats = {
      total: vehicles.length,
      vendus: vehicles.filter(v => v.reservations.some(r => r.type === 'ACHAT' && r.status === 'ACCEPTED' && (!r.dateFin || new Date(r.dateFin) > now))).length,
      enLocation: vehicles.filter(v => v.reservations.some(r => r.type === 'LOCATION' && r.status === 'ACCEPTED' && new Date(r.dateFin!) > now)).length,
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
          r.status === 'ACCEPTED' && (r.dateFin ? new Date(r.dateFin) > now : true)
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

// GET PARKING STATS
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

// GET SPECIFIC VEHICLE FOR PARKING USER WITH STATS
export const getParkingUserVehicleById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const vehicleId = parseInt(id);

    if (isNaN(vehicleId)) {
      return res.status(400).json({ error: 'ID de véhicule invalide' });
    }

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

    // Récupérer le véhicule spécifique du parking avec les relations nécessaires
    const vehicle = await prisma.vehicle.findFirst({
      where: { 
        id: vehicleId,
        parkingId: parking.id
      },
      include: {
        userOwner: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            phone: true
          }
        },
        stats: {
          select: {
            vues: true,
            reservations: true,
            createdAt: true,
            updatedAt: true
          }
        },
        favorites: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                nom: true,
                prenom: true,
                email: true
              }
            }
          }
        },
        reservations: {
          include: {
            user: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                email: true,
                phone: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        parking: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true
          }
        },
        history: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        marqueRef: true
      }
    });

    if (!vehicle) {
      return res.status(404).json({ 
        error: 'Véhicule non trouvé ou vous n\'avez pas les droits pour accéder à ce véhicule.' 
      });
    }

    // Formater les statistiques détaillées
    const now = new Date();
    const formattedVehicle = {
      ...vehicle,
      stats: {
        vues: vehicle.stats?.vues || 0,
        reservations: vehicle.stats?.reservations || 0,
        favoris: vehicle.favorites.length,
        reservationsActives: vehicle.reservations.filter(r => 
          r.status === 'ACCEPTED' && (r.dateFin ? new Date(r.dateFin) > now : true)
        ).length,
        reservationsTotal: vehicle.reservations.length
      }
    };

    return res.json({
      parking: {
        id: parking.id,
        name: parking.name
      },
      vehicle: formattedVehicle
    });

  } catch (err) {
    console.error('Erreur lors de la récupération du véhicule:', err);
    return res.status(500).json({ 
      error: 'Erreur lors de la récupération du véhicule',
      details: err instanceof Error ? err.message : 'Erreur inconnue'
    });
  }
};

// GET PARKING MANAGEMENT DATA
export const getParkingManagementData = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== Role.PARKING) {
      return res.status(403).json({ 
        error: 'Accès refusé. Seuls les utilisateurs PARKING peuvent accéder à cette ressource.' 
      });
    }

    const { status, search } = req.query;
    const userId = req.user.id;

    // Trouver le parking associé à cet utilisateur
    const parking = await prisma.parking.findFirst({
      where: { userId: userId },
      select: { 
        id: true, 
        name: true,
        address: true,
        phone: true,
        logo: true
      }
    });

    if (!parking) {
      return res.status(404).json({ 
        error: 'Aucun parking trouvé pour cet utilisateur.' 
      });
    }

    // Construire les filtres de recherche
    const where: any = { 
      parkingId: parking.id 
    };

    // Filtrer par statut si spécifié
    if (status && status !== 'all') {
      where.status = status as string;
    }

    // Filtrer par recherche textuelle
    if (search) {
      where.OR = [
        { marqueRef: { name: { contains: search as string, mode: 'insensitive' } } },
        { model: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Récupérer les véhicules avec les relations nécessaires
    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        stats: {
          select: {
            vues: true,
            reservations: true
          }
        },
        favorites: {
          select: {
            id: true
          }
        },
        reservations: {
          where: {
            status: 'ACCEPTED',
            dateFin: {
              gte: new Date()
            }
          },
          select: {
            id: true,
            type: true,
            dateDebut: true,
            dateFin: true,
            status: true,
            user: {
              select: {
                nom: true,
                prenom: true,
                email: true
              }
            }
          },
          orderBy: {
            dateDebut: 'asc'
          }
        },
        marqueRef: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Récupérer toutes les réservations des 6 derniers mois pour les graphiques
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyReservations = await prisma.reservation.groupBy({
      by: ['type', 'createdAt'],
      where: {
        status: 'ACCEPTED',
        vehicle: {
          parkingId: parking.id
        },
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      _count: {
        id: true
      }
    });

    // Calculer les statistiques globales
    const now = new Date();
    const activeReservations = vehicles.flatMap(v => v.reservations)
      .filter(r => {
        const dateDebut = r.dateDebut ? new Date(r.dateDebut) : null;
        const dateFin = r.dateFin ? new Date(r.dateFin) : null;

        return r.status === 'ACCEPTED' && dateFin
          ? dateDebut !== null && dateDebut <= now && dateFin >= now
          : dateDebut !== null && dateDebut <= now;
      });

    const stats = {
      total: vehicles.length,
      vendus: vehicles.filter(v => v.reservations.some(r => r.type === 'ACHAT' && r.status === 'ACCEPTED' && (!r.dateFin || new Date(r.dateFin) > now))).length,
      enLocation: vehicles.filter(v => v.reservations.some(r => r.type === 'LOCATION' && r.status === 'ACCEPTED' && (r.dateFin && new Date(r.dateFin) > now))).length,
      disponibles: vehicles.filter(v => v.status === 'DISPONIBLE').length,
      enMaintenance: vehicles.filter(v => v.status === 'EN_MAINTENANCE').length,
      indisponibles: vehicles.filter(v => v.status === 'INDISPONIBLE').length,
      totalVues: vehicles.reduce((sum, vehicle) => sum + (vehicle.stats?.vues || 0), 0),
      totalReservations: vehicles.reduce((sum, vehicle) => sum + (vehicle.stats?.reservations || 0), 0),
      totalFavoris: vehicles.reduce((sum, vehicle) => sum + vehicle.favorites.length, 0),
      reservationsActives: activeReservations.length,
      monthlySales: monthlyReservations.filter(r => r.type === 'ACHAT').reduce((sum, r) => sum + (r._count?.id || 0), 0),
      monthlyRentals: monthlyReservations.filter(r => r.type === 'LOCATION').reduce((sum, r) => sum + (r._count?.id || 0), 0)
    };

    // Préparer les données pour les graphiques
    const monthlyData = prepareMonthlyChartData(monthlyReservations);

    // Formater les véhicules pour l'affichage
    const formattedVehicles = vehicles.map(vehicle => ({
      id: vehicle.id,
      marque: vehicle.marqueRef?.name || '', 
      model: vehicle.model,
      prix: vehicle.prix,
      status: vehicle.status,
      photos: vehicle.photos,
      createdAt: vehicle.createdAt,
      forSale: vehicle.forSale,
      forRent: vehicle.forRent,
      marqueRef: vehicle.marqueRef ? { 
        id: vehicle.marqueRef.id,
        name: vehicle.marqueRef.name,
        logoUrl: vehicle.marqueRef.logoUrl || null,
      } : null,
      stats: {
        vues: vehicle.stats?.vues || 0,
        reservations: vehicle.stats?.reservations || 0,
        favoris: vehicle.favorites.length,
        reservationsActives: vehicle.reservations.filter(r => {
          const dateDebut = r.dateDebut ? new Date(r.dateDebut) : null;
          const dateFin = r.dateFin ? new Date(r.dateFin) : null;
          return r.status === 'ACCEPTED' && dateDebut !== null && (
            dateFin
              ? dateDebut <= now && dateFin >= now
              : dateDebut <= now
          );
        }).length
      },
      nextReservation: vehicle.reservations.find(r => r.status === 'ACCEPTED') ? {
        type: vehicle.reservations.find(r => r.status === 'ACCEPTED')!.type,
        date: vehicle.reservations.find(r => r.status === 'ACCEPTED')!.dateDebut,
        client: vehicle.reservations.find(r => r.status === 'ACCEPTED')!.user ? 
          `${vehicle.reservations.find(r => r.status === 'ACCEPTED')!.user!.prenom} ${vehicle.reservations.find(r => r.status === 'ACCEPTED')!.user!.nom}` : 'Inconnu'
      } : null
    }));

    return res.json({
      parking: {
        id: parking.id,
        name: parking.name,
        address: parking.address,
        phone: parking.phone,
        logo: parking.logo
      },
      statistics: stats,
      vehicles: formattedVehicles,
      charts: {
        monthlyData,
        statusDistribution: {
          labels: ['Disponibles', 'Maintenance', 'Indisponibles'],
          data: [
            stats.disponibles,
            stats.enMaintenance,
            stats.indisponibles
          ]
        }
      },
      filters: {
        currentStatus: status || 'all',
        currentSearch: search || ''
      }
    });

  } catch (err) {
    console.error('Erreur lors de la récupération des données de gestion du parking:', err);
    return res.status(500).json({ 
      error: 'Erreur lors de la récupération des données de gestion',
      details: err instanceof Error ? err.message : 'Erreur inconnue'
    });
  }
};

// Fonction helper pour préparer les données mensuelles des graphiques
function prepareMonthlyChartData(monthlyReservations: any[]) {
  const now = new Date();
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  
  const salesData = Array(6).fill(0);
  const rentalData = Array(6).fill(0);

  monthlyReservations.forEach(item => {
    const reservationDate = new Date(item.createdAt);
    const monthDiff = now.getMonth() - reservationDate.getMonth();
    
    if (monthDiff >= 0 && monthDiff < 6) {
      const index = 5 - monthDiff;
      if (item.type === 'ACHAT') {
        salesData[index] += (item._count?.id || 0);
      } else if (item.type === 'LOCATION') {
        rentalData[index] += (item._count?.id || 0);
      }
    }
  });

  // Générer les labels des 6 derniers mois
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    labels.push(months[date.getMonth()]);
  }

  return {
    labels,
    sales: salesData,
    rentals: rentalData
  };
}
// ADD VEHICLE VIEW WITH USER TRACKING
export const addVehicleView = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const vehicule = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) }
    });

    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    // Enregistrer la vue dans l'historique si utilisateur connecté (avec le schéma actuel)
    if (userId) {
      await prisma.vehicleHistory.create({
        data: {
          vehicleId: parseInt(id),
          changes: JSON.stringify({
            action: 'VIEW',
            userId: userId,
            timestamp: new Date().toISOString(),
            details: 'Consultation du véhicule'
          })
        }
      });
    }

    // Mettre à jour les statistiques de vues
    await prisma.vehicleStats.upsert({
      where: { vehicleId: parseInt(id) },
      update: { vues: { increment: 1 } },
      create: {
        vehicleId: parseInt(id),
        vues: 1,
        reservations: 0
      }
    });

    return res.json({ message: 'Vue enregistrée avec succès' });
  } catch (err) {
    console.error('Erreur lors de l\'ajout de la vue:', err);
    return res.status(500).json({ 
      error: 'Erreur lors de l\'enregistrement de la vue' 
    });
  }
};