import { Request, Response } from 'express';
import { PrismaClient, ReservationType, VehicleStatus, NotificationType, ReservationStatus } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { notifyUser, notifyParkingOwner, notifyAdmins } from '../utils/sendNotification';

const prisma = new PrismaClient();

const reservationSchema = z
  .object({
    vehicleId: z.number(),
    dateDebut: z.string().datetime().optional().nullable(),
    dateFin: z.string().datetime().optional().nullable(),
    type: z.nativeEnum(ReservationType),
    motifLocation: z.string().optional().nullable(),
    localisation: z.enum(['BAMAKO', 'HORS_BAMAKO']).optional().nullable(),
    conditionsAcceptees: z.boolean().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.type === ReservationType.LOCATION) {
        // Validation des dates pour location
        if (!data.dateDebut || !data.dateFin) return false;
        
        const startDate = new Date(data.dateDebut);
        const endDate = new Date(data.dateFin);
        
        // Permettre une réservation d'au moins 1 jour (24h)
        // La date de fin doit être après la date de début
        // Même si c'est le même jour, la fin doit être après le début
        return startDate < endDate;
      }
      return true;
    },
    {
      message:
        'Pour une location, les dates de début et de fin sont requises et la date de fin doit être après la date de début',
    }
  )
  .refine(
    (data) => {
      if (data.type === ReservationType.LOCATION) {
        // Vérifier que le motif est présent
        if (!data.motifLocation || data.motifLocation.trim() === '') return false;
        // Vérifier que la localisation est présente
        if (!data.localisation) return false;
        // Vérifier que les conditions sont acceptées
        if (!data.conditionsAcceptees) return false;
      }
      return true;
    },
    {
      message: 'Pour une location, le motif, la localisation et l\'acceptation des conditions sont obligatoires',
      path: ['type'],
    }
  );

export const createReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const data = reservationSchema.parse(req.body);
    const { 
      vehicleId, 
      dateDebut, 
      dateFin, 
      type, 
      motifLocation, 
      localisation, 
      conditionsAcceptees 
    } = data;
    const userId = req.user.id;

    const startDate = dateDebut ? new Date(dateDebut) : null;
    const endDate = dateFin ? new Date(dateFin) : null;

    // Récupérer le véhicule avec ses réservations
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        reservations: {
          where: {
            status: { in: [ReservationStatus.PENDING, ReservationStatus.ACCEPTED] },
          },
        },
        marqueRef: true,
      },
    });

    if (!vehicle) return res.status(404).json({ message: 'Véhicule non trouvé' });

    // Vérifications de disponibilité générale
    if (type === ReservationType.ACHAT && !vehicle.forSale)
      return res.status(400).json({ message: "Ce véhicule n'est pas destiné à la vente" });

    if (type === ReservationType.LOCATION && !vehicle.forRent)
      return res.status(400).json({ message: "Ce véhicule n'est pas destiné à la location" });

    if (vehicle.status !== VehicleStatus.DISPONIBLE)
      return res.status(400).json({ message: "Ce véhicule n'est pas disponible" });

    // Vérification pour l'achat : pas de demande d'achat en cours
    if (type === ReservationType.ACHAT) {
      const existingPurchaseRequest = vehicle.reservations.find(
        (r) => r.type === ReservationType.ACHAT
      );

      if (existingPurchaseRequest) {
        return res.status(400).json({
          message:
            'Ce véhicule fait déjà l\'objet d\'une demande d\'achat en cours. Vous ne pouvez pas en faire une autre tant que celle-ci n\'est pas traitée.',
        });
      }
    }

    // Vérification des conflits de dates pour les locations
    if (type === ReservationType.LOCATION && startDate && endDate) {
      const conflict = await prisma.reservation.findFirst({
        where: {
          vehicleId,
          status: ReservationStatus.ACCEPTED,
          type: ReservationType.LOCATION,
          OR: [
            // Conflit : une réservation existante chevauche la nouvelle
            {
              dateDebut: { lt: endDate },
              dateFin: { gt: startDate },
            },
            // Ou la nouvelle réservation est complètement à l'intérieur d'une existante
            {
              dateDebut: { lte: startDate },
              dateFin: { gte: endDate },
            },
          ],
        },
      });

      if (conflict) {
        return res.status(400).json({ 
          message: 'Le véhicule est déjà réservé pour cette période',
          conflictDetails: {
            existingStart: conflict.dateDebut,
            existingEnd: conflict.dateFin
          }
        });
      }
    }

    const commission = type === ReservationType.LOCATION ? vehicle.prix * 0.1 : null;

    // Créer la réservation avec tous les champs
    const reservation = await prisma.reservation.create({
      data: {
        userId,
        vehicleId,
        dateDebut: startDate,
        dateFin: endDate,
        type,
        motifLocation: type === ReservationType.LOCATION ? motifLocation : null,
        localisation: type === ReservationType.LOCATION ? localisation : null,
        conditionsAcceptees: type === ReservationType.LOCATION ? conditionsAcceptees : null,
        commission,
        status: ReservationStatus.PENDING,
      },
      include: {
        vehicle: { include: { marqueRef: true } },
        user: true,
      },
    });
    
    // Notifications
    await notifyUser(
      userId,
      'Demande de réservation envoyée',
      type === ReservationType.ACHAT
        ? `Votre demande d'achat du véhicule ${vehicle.marqueRef?.name ?? ''} ${vehicle.model} est en attente de confirmation.`
        : `Votre demande de location du véhicule ${vehicle.marqueRef?.name ?? ''} ${vehicle.model} est en attente.`,
      NotificationType.RESERVATION,
      { reservationId: reservation.id, vehicleId }
    );

    if (vehicle.parkingId) {
      await notifyParkingOwner(
        vehicle.parkingId,
        'Nouvelle demande de réservation',
        `Nouvelle demande de ${type.toLowerCase()} pour le véhicule ${vehicle.marqueRef?.name ?? ''} ${vehicle.model}.`,
        NotificationType.RESERVATION,
        { reservationId: reservation.id, vehicleId }
      );
    }

    // Notifier également les administrateurs
    await notifyAdmins(
      'Nouvelle réservation reçue',
      `Le véhicule ${vehicle.marqueRef?.name ?? ''} ${vehicle.model} a reçu une demande de ${type.toLowerCase()}.`,
      NotificationType.RESERVATION,
      { reservationId: reservation.id, vehicleId, parkingId: vehicle.parkingId }
    );

    return res.status(201).json(reservation);
  } catch (err) {
    console.error('Erreur création réservation:', err);
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateReservationStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const { id } = req.params;
    const { status, reason } = req.body;

    // Validation du statut
    const validStatuses = Object.values(ReservationStatus);
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Statut invalide',
        validStatuses
      });
    }

    // Trouver la réservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: Number(id) },
      include: {
        vehicle: {
          include: {
            marqueRef: true,
            parking: true
          }
        },
        user: true
      },
    });

    if (!reservation)
      return res.status(404).json({ message: 'Réservation non trouvée' });

    // Vérifier les permissions selon le rôle
    let hasPermission = false;
   
    if (req.user.role === 'ADMIN') {
      hasPermission = true;
    }
    else if (req.user.role === 'PARKING') {
      const parking = await prisma.parking.findUnique({
        where: { userId: req.user.id },
      });
      hasPermission = parking != null && reservation.vehicle.parkingId === parking.id;
    }
    else if (req.user.role === 'CLIENT') {
      hasPermission = reservation.userId === req.user.id;
      // Les clients ne peuvent que cancel leurs propres réservations
      if (hasPermission && status !== ReservationStatus.CANCELED) {
        return res.status(403).json({ message: 'Vous ne pouvez qu\'annuler vos propres réservations' });
      }
    }

    if (!hasPermission)
      return res.status(403).json({ message: 'Accès non autorisé' });

    // Logique de validation selon le statut
    if (status === ReservationStatus.ACCEPTED) {
      // Seul le parking peut accepter
      if (req.user.role !== 'PARKING' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Seul le parking peut accepter une réservation' });
      }

      if (reservation.status !== ReservationStatus.PENDING) {
        return res.status(400).json({ message: 'Seules les réservations en attente peuvent être acceptées' });
      }

      // Vérifier les conflits de dates pour les locations
      if (reservation.type === ReservationType.LOCATION && reservation.dateDebut && reservation.dateFin) {
        const conflict = await prisma.reservation.findFirst({
          where: {
            vehicleId: reservation.vehicleId,
            status: ReservationStatus.ACCEPTED,
            id: { not: reservation.id },
            type: ReservationType.LOCATION,
            OR: [
              {
                dateDebut: { lt: reservation.dateFin },
                dateFin: { gt: reservation.dateDebut },
              },
            ],
          },
        });

        if (conflict) {
          return res.status(400).json({ 
            message: 'Conflit de dates détecté',
            conflictDetails: {
              existingStart: conflict.dateDebut,
              existingEnd: conflict.dateFin
            }
          });
        }
      }
    }
    else if (status === ReservationStatus.CANCELED) {
      // Vérifier les règles d'annulation
      if (reservation.status === ReservationStatus.CANCELED) {
        return res.status(400).json({ message: 'Cette réservation est déjà annulée' });
      }

      // Pour les locations, vérifier le délai de 12h (réduit de 24h)
      if (req.user.role === 'CLIENT' && reservation.type === ReservationType.LOCATION && reservation.dateDebut) {
        const now = new Date();
        const minCancelTime = new Date(reservation.dateDebut);
        // Réduire à 12 heures au lieu de 24
        minCancelTime.setHours(minCancelTime.getHours() - 12);
       
        if (now > minCancelTime) {
          return res.status(400).json({
            message: 'Annulation impossible moins de 12h avant le début de la location',
            earliestCancelTime: minCancelTime,
            currentTime: now
          });
        }
      }
    }
    else if (status === ReservationStatus.PENDING) {
      return res.status(400).json({ message: 'Impossible de revenir au statut PENDING' });
    }

    // Mettre à jour la réservation
    const updatedReservation = await prisma.reservation.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        vehicle: { include: { marqueRef: true } },
        user: true
      },
    });

    // Gérer les effets secondaires
    const wasAccepted = reservation.status === ReservationStatus.ACCEPTED;
    const willBeAccepted = status === ReservationStatus.ACCEPTED;

    // Mettre à jour le statut du véhicule pour les achats
    if (reservation.type === ReservationType.ACHAT) {
      if (willBeAccepted) {
        await prisma.vehicle.update({
          where: { id: reservation.vehicleId },
          data: { status: VehicleStatus.INDISPONIBLE },
        });
      } else if (wasAccepted && status !== ReservationStatus.ACCEPTED) {
        await prisma.vehicle.update({
          where: { id: reservation.vehicleId },
          data: { status: VehicleStatus.DISPONIBLE },
        });
      }
    }

    // Mettre à jour les statistiques
    if (wasAccepted && !willBeAccepted) {
      // Décrémenter si on passe d'ACCEPTED à autre chose
      await prisma.vehicleStats.update({
        where: { vehicleId: reservation.vehicleId },
        data: { reservations: { decrement: 1 } },
      });
    } else if (!wasAccepted && willBeAccepted) {
      // Incrémenter si on passe à ACCEPTED
      await prisma.vehicleStats.upsert({
        where: { vehicleId: reservation.vehicleId },
        update: { reservations: { increment: 1 } },
        create: { vehicleId: reservation.vehicleId, reservations: 1 },
      });
    }

    // Envoyer les notifications appropriées
    await sendStatusChangeNotification(reservation, status, reason, req.user.role);

    return res.json(updatedReservation);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Fonction helper pour les notifications sur tout changement de statut
async function sendStatusChangeNotification(
  reservation: any,
  newStatus: ReservationStatus,
  reason?: string,
  changedByRole?: string
) {
  const vehicleName = `${reservation.vehicle.marqueRef?.name ?? 'Véhicule'} ${reservation.vehicle.model ?? ''}`.trim();
  let titleClient = '';
  let messageClient = '';
  let titleParking = '';
  let messageParking = '';
  let titleAdmin = '';
  let messageAdmin = '';

  switch (newStatus) {
    case ReservationStatus.ACCEPTED:
      titleClient = 'Réservation acceptée !';
      messageClient = reservation.type === ReservationType.ACHAT
        ? `Félicitations ! Votre demande d'achat du véhicule ${vehicleName} a été confirmée.`
        : `Bonne nouvelle ! Votre réservation pour le véhicule ${vehicleName} a été confirmée.`;

      titleParking = 'Réservation confirmée';
      messageParking = `La réservation pour ${vehicleName} a été confirmée avec succès.`;

      titleAdmin = 'Réservation confirmée';
      messageAdmin = `La réservation #${reservation.id} pour ${vehicleName} a été confirmée par ${changedByRole === 'PARKING' ? 'le parking' : 'l\'administrateur'}.`;
      break;

    case ReservationStatus.REJECTED:
      titleClient = 'Demande de réservation refusée';
      messageClient = `Votre demande pour le véhicule ${vehicleName} n'a pas pu être acceptée${reason ? ` : ${reason}` : '.'}`;

      titleParking = 'Réservation refusée';
      messageParking = `La demande de réservation #${reservation.id} pour ${vehicleName} a été refusée.`;

      titleAdmin = 'Réservation refusée';
      messageAdmin = `La réservation #${reservation.id} pour ${vehicleName} a été refusée par ${changedByRole === 'PARKING' ? 'le parking' : 'l\'administrateur'}${reason ? ` (Motif: ${reason})` : ''}.`;
      break;

    case ReservationStatus.CANCELED:
      const cancelAuthor = changedByRole === 'CLIENT' ? 'le client' : changedByRole === 'PARKING' ? 'le parking' : 'l\'administrateur';
      titleClient = 'Réservation annulée';
      messageClient = changedByRole === 'CLIENT'
        ? `Vous avez annulé votre réservation pour ${vehicleName}.`
        : `Votre réservation pour ${vehicleName} a été annulée par ${cancelAuthor}${reason ? ` : ${reason}` : '.'}`;

      titleParking = 'Réservation annulée';
      messageParking = `La réservation #${reservation.id} pour ${vehicleName} a été annulée par ${cancelAuthor}${reason ? ` : ${reason}` : '.'}`;

      titleAdmin = 'Réservation annulée';
      messageAdmin = `La réservation #${reservation.id} pour ${vehicleName} a été annulée par ${cancelAuthor}${reason ? ` : ${reason}` : ''}.`;
      break;

    default:
      return;
  }

  // 1. Notifier le CLIENT
  await notifyUser(
    reservation.userId,
    titleClient,
    messageClient,
    NotificationType.RESERVATION,
    { reservationId: reservation.id, vehicleId: reservation.vehicleId, status: newStatus }
  );

  // 2. Notifier le PARKING (si ce n'est pas le parking qui a initié l'action ou pour confirmer l'action)
  if (reservation.vehicle?.parkingId) {
    await notifyParkingOwner(
      reservation.vehicle.parkingId,
      titleParking,
      messageParking,
      NotificationType.RESERVATION,
      { reservationId: reservation.id, vehicleId: reservation.vehicleId, status: newStatus }
    );
  }

  // 3. Notifier l'ADMIN
  await notifyAdmins(
    titleAdmin,
    messageAdmin,
    NotificationType.RESERVATION,
    { reservationId: reservation.id, vehicleId: reservation.vehicleId, status: newStatus }
  );
}

export const getAllReservations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN')
      return res.status(403).json({ message: 'Accès non autorisé' });

    const reservations = await prisma.reservation.findMany({
      include: { 
        user: true, 
        vehicle: { 
          include: { 
            marqueRef: true 
          } 
        } 
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(reservations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getAllReservationsForParking = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'PARKING')
      return res.status(403).json({ message: 'Accès non autorisé' });

    const parking = await prisma.parking.findUnique({
      where: { userId: req.user.id },
    });

    if (!parking) return res.status(404).json({ message: 'Parking non trouvé' });

    const reservations = await prisma.reservation.findMany({
      where: { vehicle: { parkingId: parking.id } },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true } },
        vehicle: { include: { marqueRef: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(reservations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getUserReservations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const reservations = await prisma.reservation.findMany({
      where: { userId: req.user.id },
      include: { 
        vehicle: { 
          include: { 
            marqueRef: true 
          } 
        } 
      },
      orderBy: { dateDebut: 'desc' },
    });

    return res.json(reservations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const { id } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { id: Number(id) },
      include: { 
        vehicle: { 
          include: { 
            marqueRef: true 
          } 
        }, 
        user: true 
      },
    });

    if (!reservation)
      return res.status(404).json({ message: 'Réservation non trouvée' });

    // Vérification des permissions
    if (req.user.role === 'CLIENT' && reservation.userId !== req.user.id)
      return res.status(403).json({ message: 'Accès non autorisé' });

    if (req.user.role === 'PARKING') {
      const parking = await prisma.parking.findUnique({
        where: { userId: req.user.id },
      });

      if (!parking || reservation.vehicle.parkingId !== parking.id)
        return res.status(403).json({ message: 'Accès non autorisé' });
    }

    return res.json(reservation);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN')
      return res.status(403).json({ message: 'Accès non autorisé' });

    const { id } = req.params;
    const data = reservationSchema.partial().parse(req.body);

    const existing = await prisma.reservation.findUnique({
      where: { id: Number(id) },
    });

    if (!existing)
      return res.status(404).json({ message: 'Réservation non trouvée' });

    const updated = await prisma.reservation.update({
      where: { id: Number(id) },
      data,
      include: { 
        vehicle: { 
          include: { 
            marqueRef: true 
          } 
        }, 
        user: true 
      },
    });

    await notifyUser(
      updated.userId,
      'Réservation mise à jour',
      `Votre réservation du véhicule ${updated.vehicle.marqueRef?.name ?? 'Marque inconnue'} ${updated.vehicle.model ?? ''} a été modifiée par l'administrateur.`,
      NotificationType.MESSAGE,
      { reservationId: updated.id }
    );

    return res.json(updated);
  } catch (err) {
    console.error(err);
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN')
      return res.status(403).json({ message: 'Accès non autorisé' });

    const { id } = req.params;

    const existing = await prisma.reservation.findUnique({
      where: { id: Number(id) },
    });

    if (!existing)
      return res.status(404).json({ message: 'Réservation non trouvée' });

    await prisma.reservation.delete({
      where: { id: Number(id) },
    });

    return res.json({ message: 'Réservation supprimée avec succès' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};