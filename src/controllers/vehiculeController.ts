import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';
import { put, del } from '@vercel/blob';

const prisma = new PrismaClient();

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
    } = req.body;

    // Validation des champs obligatoires
    if (!marque || !model || !prix) {
      return res.status(400).json({ error: 'Les champs marque, modèle et prix sont obligatoires.' });
    }

    // Validation de la marque
    if (typeof marque !== 'string' || marque.trim() === '') {
      return res.status(400).json({ error: 'La marque doit être une chaîne de caractères non vide.' });
    }

    if ((userOwnerId && parkingId) || (!userOwnerId && !parkingId)) {
      return res.status(400).json({
        error: 'Un véhicule doit appartenir soit à un utilisateur (userOwnerId), soit à un parking (parkingId), mais pas aux deux ou aucun.',
      });
    }

    // Valider le format des champs booléens
    const parsedGarantie = garantie === 'true' ? true : false;
    const parsedChauffeur = chauffeur === 'true' ? true : false;
    const parsedAssurance = assurance === 'true' ? true : false;
    const parsedCarteGrise = carteGrise === 'true' ? true : false;
    const parsedVignette = vignette === 'true' ? true : false;
    const parsedForSale = forSale !== undefined ? forSale === 'true' : true;
    const parsedForRent = forRent !== undefined ? forRent === 'true' : true;

    // Valider le format des champs numériques
    const parsedPrix = Number(prix);
    if (isNaN(parsedPrix)) {
      return res.status(400).json({ error: 'Le prix doit être un nombre valide.' });
    }

    const parsedYear = year ? Number(year) : null;
    if (year && isNaN(parsedYear!)) {
      return res.status(400).json({ error: "L'année doit être un nombre valide." });
    }

    const parsedDureeGarantie = dureeGarantie ? Number(dureeGarantie) : null;
    if (parsedGarantie && !parsedDureeGarantie) {
      return res.status(400).json({ error: 'La durée de garantie est obligatoire si la garantie est activée.' });
    }

    const parsedDureeAssurance = dureeAssurance ? Number(dureeAssurance) : null;
    if (parsedAssurance && !parsedDureeAssurance) {
      return res.status(400).json({ error: "La durée d'assurance est obligatoire si l'assurance est activée." });
    }

    const parsedMileage = mileage ? Number(mileage) : null;

    // Gérer la marque (trouver ou créer, avec normalisation)
    let marqueEntity = await prisma.marque.findUnique({
      where: { name: marque.toLowerCase() }, // Normalisation en minuscules pour éviter les doublons
    });
    if (!marqueEntity) {
      marqueEntity = await prisma.marque.create({
        data: { name: marque.toLowerCase() }, // Créer avec nom normalisé
      });
    }

    // Uploader les photos vers Vercel Blob
    const files = req.files as Express.Multer.File[];
    const photos: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const newFilename = `vehicles/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? file.originalname.match(/\.[0-9a-z]+$/i)?.[0] : '.jpg'}`;
        const result = await put(newFilename, file.buffer, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        photos.push(result.url);
      }
    }

    const vehicule = await prisma.vehicle.create({
      data: {
        marqueId: marqueEntity.id, // Utiliser l'ID de la marque
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
        photos,
        userOwnerId: userOwnerId ? Number(userOwnerId) : undefined,
        parkingId: parkingId ? Number(parkingId) : undefined,
      },
    });

    return res.status(201).json({ message: 'Véhicule enregistré avec succès', vehicule });
  } catch (err) {
    console.error("Erreur lors de la création du véhicule :", err);
    return res.status(500).json({
      error: "Erreur lors de la création du véhicule",
      details: err instanceof Error ? err.message : "Erreur inconnue",
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
    status,
    forSale,
    forRent,
  } = req.query;

  try {
    const where: any = {};

    if (marque) {
      where.marqueRef = { name: { contains: marque as string, mode: 'insensitive' } };
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

    if (forSale !== undefined) {
      where.forSale = forSale === 'true';
    }

    if (forRent !== undefined) {
      where.forRent = forRent === 'true';
    }

    const vehicules = await prisma.vehicle.findMany({
      where,
      include: {
        parking: true,
        userOwner: true,
        stats: true,
        favorites: true,
        marqueRef: true
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
        favorites: true,
        marqueRef: true
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
    status,
    forSale,
    forRent,
  } = req.body;

  try {
    // Vérifier si le véhicule existe
    const vehicule = await prisma.vehicle.findUnique({ where: { id: parseInt(id) } });
    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    // Valider les champs numériques si fournis
    const parsedPrix = prix ? Number(prix) : undefined;
    if (prix && parsedPrix !== undefined && isNaN(parsedPrix)) {
      return res.status(400).json({ error: 'Le prix doit être un nombre valide.' });
    }

    const parsedYear = year ? Number(year) : undefined;
    if (year && parsedYear !== undefined && isNaN(parsedYear)) {
      return res.status(400).json({ error: "L'année doit être un nombre valide." });
    }

    const parsedDureeGarantie = dureeGarantie ? Number(dureeGarantie) : undefined;
    if (garantie === 'true' && parsedDureeGarantie == null) {
      return res.status(400).json({ error: 'La durée de garantie est obligatoire si la garantie est activée.' });
    }

    const parsedDureeAssurance = dureeAssurance ? Number(dureeAssurance) : undefined;
    if (assurance === 'true' && parsedDureeAssurance == null) {
      return res.status(400).json({ error: "La durée d'assurance est obligatoire si l'assurance est activée." });
    }

    const parsedMileage = mileage ? Number(mileage) : undefined;

    // Gérer la marque si fournie (trouver ou créer avec normalisation)
    let marqueId: number | undefined = undefined;
    if (marque) {
      if (typeof marque !== 'string' || marque.trim() === '') {
        return res.status(400).json({ error: 'La marque doit être une chaîne de caractères non vide.' });
      }
      let marqueEntity = await prisma.marque.findUnique({
        where: { name: marque.toLowerCase() }, // Normalisation en minuscules
      });
      if (!marqueEntity) {
        marqueEntity = await prisma.marque.create({
          data: { name: marque.toLowerCase() }, // Créer avec nom normalisé
        });
      }
      marqueId = marqueEntity.id;
    }

    // Gérer les booléens forSale et forRent si fournis
    const parsedForSale = forSale !== undefined ? forSale === 'true' : undefined;
    const parsedForRent = forRent !== undefined ? forRent === 'true' : undefined;

    // Gérer les nouvelles photos
    let photos = vehicule.photos; // Garder les photos existantes par défaut
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      // Supprimer les anciens blobs si existants
      if (photos && photos.length > 0) {
        for (const photo of photos) {
          try {
            const url = new URL(photo);
            await del(url.pathname.slice(1));
          } catch (error) {
            console.warn(`Ancien blob non supprimé, URL invalide : ${photo}`);
          }
        }
      }

      // Uploader les nouvelles photos
      photos = [];
      for (const file of files) {
        const newFilename = `vehicles/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? file.originalname.match(/\.[0-9a-z]+$/i)?.[0] : '.jpg'}`;
        const result = await put(newFilename, file.buffer, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        photos.push(result.url);
      }
    }

    const updatedVehicule = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: {
        marqueId: marqueId !== undefined ? marqueId : vehicule.marqueId,
        model,
        year: parsedYear,
        prix: parsedPrix,
        description,
        fuelType,
        mileage: parsedMileage,
        garantie: garantie === 'true' ? true : garantie === 'false' ? false : undefined,
        dureeGarantie: parsedDureeGarantie,
        chauffeur: chauffeur === 'true' ? true : chauffeur === 'false' ? false : undefined,
        assurance: assurance === 'true' ? true : assurance === 'false' ? false : undefined,
        dureeAssurance: parsedDureeAssurance,
        carteGrise: carteGrise === 'true' ? true : carteGrise === 'false' ? false : undefined,
        vignette: vignette === 'true' ? true : vignette === 'false' ? false : undefined,
        forSale: parsedForSale,
        forRent: parsedForRent,
        status,
        photos,
      },
    });

    return res.json({ message: 'Véhicule mis à jour', vehicule: updatedVehicule });
  } catch (err: any) {
    console.error('Erreur lors de la mise à jour du véhicule :', err);
    if (err.code === 'P2002') {
      return res.status(400).json({
        error: 'Un doublon a été détecté pour la marque.',
        details: 'La marque existe déjà avec un nom similaire (insensible à la casse).',
      });
    }
    return res.status(500).json({
      error: 'Erreur lors de la mise à jour du véhicule',
      details: err instanceof Error ? err.message : 'Erreur inconnue',
    });
  }
};

// DELETE VEHICULE
export const deleteVehicule = async (req: Request, res: Response) => {
  const { id } = req.params;
  const vehiculeId = parseInt(id, 10);

  if (isNaN(vehiculeId)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    // Vérifier si le véhicule existe et récupérer les photos
    const vehicule = await prisma.vehicle.findUnique({ where: { id: vehiculeId }, select: { photos: true } });
    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }

    // Supprimer les blobs associés aux photos
    if (vehicule.photos && vehicule.photos.length > 0) {
      for (const photo of vehicule.photos) {
        try {
          const url = new URL(photo);
          await del(url.pathname.slice(1));
        } catch (error) {
          console.warn(`Ancien blob non supprimé, URL invalide : ${photo}`);
        }
      }
    }

    // Supprimer les dépendances
    await prisma.reservation.deleteMany({ where: { vehicleId: vehiculeId } });
    await prisma.vehicleHistory.deleteMany({ where: { vehicleId: vehiculeId } });
    await prisma.favorite.deleteMany({ where: { vehicleId: vehiculeId } });
    await prisma.vehicleStats.deleteMany({ where: { vehicleId: vehiculeId } });

    // Puis supprimer le véhicule
    await prisma.vehicle.delete({
      where: { id: vehiculeId },
    });

    return res.json({ message: 'Véhicule supprimé avec succès' });
  } catch (err: any) {
    console.error('Erreur suppression véhicule:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Impossible de supprimer : véhicule lié à d’autres données' });
    }
    return res.status(500).json({
      error: 'Erreur lors de la suppression du véhicule',
      details: err.message || 'Erreur inconnue',
    });
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
            dateFin: true
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
      vendus: vehicles.filter(v => v.reservations.some(r => r.type === 'ACHAT' && (!r.dateFin || new Date(r.dateFin) > now))).length,
      enLocation: vehicles.filter(v => v.reservations.some(r => r.type === 'LOCATION' && new Date(r.dateFin!) > now)).length,
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
          (r.dateFin ? new Date(r.dateFin) > now : true)
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
          (r.dateFin ? new Date(r.dateFin) > now : true)
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
            dateFin: {
              gte: new Date()
            }
          },
          select: {
            id: true,
            type: true,
            dateDebut: true,
            dateFin: true,
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

    return dateFin
      ? dateDebut !== null && dateDebut <= now && dateFin >= now
      : dateDebut !== null && dateDebut <= now;
  });

    const stats = {
      total: vehicles.length,
      vendus: vehicles.filter(v => v.reservations.some(r => r.type === 'ACHAT' && (!r.dateFin || new Date(r.dateFin) > now))).length,
      enLocation: vehicles.filter(v => v.reservations.some(r => r.type === 'LOCATION' && (r.dateFin && new Date(r.dateFin) > now))).length,
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
      marque: vehicle.marqueRef?.name,
      model: vehicle.model,
      prix: vehicle.prix,
      status: vehicle.status,
      photos: vehicle.photos,
      createdAt: vehicle.createdAt,
      forSale: vehicle.forSale,
      forRent: vehicle.forRent,
      stats: {
        vues: vehicle.stats?.vues || 0,
        reservations: vehicle.stats?.reservations || 0,
        favoris: vehicle.favorites.length,
        reservationsActives: vehicle.reservations.filter(r => {
        const dateDebut = r.dateDebut ? new Date(r.dateDebut) : null;
        const dateFin = r.dateFin ? new Date(r.dateFin) : null;

        return dateDebut !== null && (
          dateFin
            ? dateDebut <= now && dateFin >= now
            : dateDebut <= now
        );
      }).length
      },
      nextReservation: vehicle.reservations[0] ? {
        type: vehicle.reservations[0].type,
        date: vehicle.reservations[0].dateDebut,
        client: vehicle.reservations[0].user ? 
          `${vehicle.reservations[0].user.prenom} ${vehicle.reservations[0].user.nom}` : 'Inconnu'
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