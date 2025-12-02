import { Request, Response } from 'express';
import { PrismaClient, ReservationType, VehicleStatus, NotificationType, ReservationStatus } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { notifyUser, notifyParkingOwner } from '../utils/sendNotification';

const prisma = new PrismaClient();

const reservationSchema = z
  .object({
    vehicleId: z.number(),
    dateDebut: z.string().datetime().optional().nullable(),
    dateFin: z.string().datetime().optional().nullable(),
    type: z.nativeEnum(ReservationType),
  })
  .refine(
    (data) => {
      if (data.type === ReservationType.LOCATION) {
        return (
          data.dateDebut &&
          data.dateFin &&
          new Date(data.dateDebut) < new Date(data.dateFin)
        );
      }
      return true;
    },
    {
      message:
        'Les dates de début et de fin sont requises pour une location et doivent être valides',
    }
  );

export const createReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const data = reservationSchema.parse(req.body);
    const { vehicleId, dateDebut, dateFin, type } = data;
    const userId = req.user.id;

    const startDate = dateDebut ? new Date(dateDebut) : null;
    const endDate = dateFin ? new Date(dateFin) : null;

    if (
      type === ReservationType.LOCATION &&
      (!startDate || !endDate || startDate >= endDate)
    ) {
      return res
        .status(400)
        .json({ message: 'La date de fin doit être après la date de début pour une location' });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { reservations: true, marqueRef: true },
    });

    if (!vehicle) return res.status(404).json({ message: 'Véhicule non trouvé' });

    if (type === ReservationType.ACHAT && !vehicle.forSale)
      return res.status(400).json({ message: "Ce véhicule n'est pas destiné à la vente" });

    if (type === ReservationType.LOCATION && !vehicle.forRent)
      return res.status(400).json({ message: "Ce véhicule n'est pas destiné à la location" });

    if (vehicle.status !== VehicleStatus.DISPONIBLE)
      return res.status(400).json({ message: "Ce véhicule n'est pas disponible" });

    // Vérifier les conflits de dates avec les réservations ACCEPTED
    if (type === ReservationType.LOCATION) {
      const conflict = await prisma.reservation.findFirst({
        where: {
          vehicleId,
          status: ReservationStatus.ACCEPTED,
          OR: [
            {
              dateDebut: { lte: endDate! },
              dateFin: { gte: startDate! },
            },
          ],
        },
      });

      if (conflict)
        return res.status(400).json({ message: 'Le véhicule est déjà réservé pour cette période' });
    }

    const commission = type === ReservationType.LOCATION ? vehicle.prix * 0.1 : null;

    const reservation = await prisma.reservation.create({
      data: {
        userId,
        vehicleId,
        dateDebut: startDate,
        dateFin: endDate,
        type,
        commission,
        status: ReservationStatus.PENDING,
      },
      include: {
        vehicle: { include: { marqueRef: true } },
        user: true,
      },
    });

    // Notifications pour demande en attente
    await notifyUser(
      userId,
      'Demande de réservation envoyée',
      type === ReservationType.ACHAT
        ? `Votre demande d'achat du véhicule ${vehicle.marqueRef?.name ?? 'Marque inconnue'} ${vehicle.model ?? ''} est en attente de confirmation.`
        : `Votre demande de location du véhicule ${vehicle.marqueRef?.name ?? 'Marque inconnue'} ${vehicle.model ?? ''} du ${dateDebut} au ${dateFin} est en attente de confirmation.`,
      NotificationType.RESERVATION,
      { reservationId: reservation.id, vehicleId }
    );

    if (vehicle.parkingId) {
      await notifyParkingOwner(
        vehicle.parkingId,
        'Nouvelle demande de réservation',
        `Un client a demandé une ${type.toLowerCase()} pour votre véhicule ${vehicle.marqueRef?.name ?? 'Marque inconnue'} ${vehicle.model ?? ''}.`,
        NotificationType.RESERVATION,
        { reservationId: reservation.id, vehicleId }
      );
    }

    return res.status(201).json(reservation);
  } catch (err) {
    console.error(err);
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const acceptReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'PARKING') 
      return res.status(403).json({ message: 'Accès non autorisé' });

    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id: Number(id) },
      include: { vehicle: { include: { marqueRef: true } } },
    });

    if (!reservation)
      return res.status(404).json({ message: 'Réservation non trouvée' });

    const parking = await prisma.parking.findUnique({
      where: { userId: req.user.id },
    });

    if (!parking || reservation.vehicle.parkingId !== parking.id)
      return res.status(403).json({ message: 'Accès non autorisé' });

    if (reservation.status !== ReservationStatus.PENDING)
      return res.status(400).json({ message: 'Cette réservation n\'est pas en attente' });

    // Revérifier les conflits pour LOCATION
    if (reservation.type === ReservationType.LOCATION && reservation.dateDebut && reservation.dateFin) {
      const conflict = await prisma.reservation.findFirst({
        where: {
          vehicleId: reservation.vehicleId,
          status: ReservationStatus.ACCEPTED,
          id: { not: reservation.id },
          OR: [
            {
              dateDebut: { lte: reservation.dateFin },
              dateFin: { gte: reservation.dateDebut },
            },
          ],
        },
      });

      if (conflict)
        return res.status(400).json({ message: 'Conflit de dates détecté' });
    }

    const updatedReservation = await prisma.reservation.update({
      where: { id: Number(id) },
      data: { status: ReservationStatus.ACCEPTED },
      include: { vehicle: { include: { marqueRef: true } }, user: true },
    });

    // Mettre à jour le statut du véhicule si ACHAT
    if (reservation.type === ReservationType.ACHAT) {
      await prisma.vehicle.update({
        where: { id: reservation.vehicleId },
        data: { status: VehicleStatus.INDISPONIBLE },
      });
    }

    // Incrémenter les stats
    await prisma.vehicleStats.upsert({
      where: { vehicleId: reservation.vehicleId },
      update: { reservations: { increment: 1 } },
      create: { vehicleId: reservation.vehicleId, reservations: 1 },
    });

    // Notifications
    await notifyUser(
      reservation.userId,
      'Réservation acceptée',
      reservation.type === ReservationType.ACHAT
        ? `Votre achat du véhicule ${reservation.vehicle.marqueRef?.name ?? 'Marque inconnue'} ${reservation.vehicle.model ?? ''} a été accepté.`
        : `Votre location du véhicule ${reservation.vehicle.marqueRef?.name ?? 'Marque inconnue'} ${reservation.vehicle.model ?? ''} a été acceptée du ${reservation.dateDebut?.toISOString()} au ${reservation.dateFin?.toISOString()}.`,
      NotificationType.RESERVATION,
      { reservationId: reservation.id, vehicleId: reservation.vehicleId }
    );

    return res.json(updatedReservation);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getAllReservations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN')
      return res.status(403).json({ message: 'Accès non autorisé' });

    const reservations = await prisma.reservation.findMany({
      include: { user: true, vehicle: { include: { marqueRef: true } } },
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
      include: { vehicle: { include: { marqueRef: true } } },
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
      include: { vehicle: { include: { marqueRef: true } }, user: true },
    });

    if (!reservation)
      return res.status(404).json({ message: 'Réservation non trouvée' });

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

export const cancelReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const { id } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { id: Number(id) },
      include: { vehicle: { include: { marqueRef: true } } },
    });

    if (!reservation)
      return res.status(404).json({ message: 'Réservation non trouvée' });

    if (req.user.role === 'CLIENT' && reservation.userId !== req.user.id)
      return res.status(403).json({ message: 'Accès non autorisé' });

    if (req.user.role === 'PARKING') {
      const parking = await prisma.parking.findUnique({
        where: { userId: req.user.id },
      });

      if (!parking || reservation.vehicle.parkingId !== parking.id)
        return res.status(403).json({ message: 'Accès non autorisé' });
    }

    if (reservation.status === ReservationStatus.CANCELED)
      return res.status(400).json({ message: 'Cette réservation est déjà annulée' });

    if (reservation.type === ReservationType.LOCATION && reservation.dateDebut) {
      const now = new Date();
      const minCancelTime = new Date(reservation.dateDebut);
      minCancelTime.setDate(minCancelTime.getDate() - 1);
      if (now > minCancelTime)
        return res
          .status(400)
          .json({ message: 'Annulation impossible moins de 24h avant' });
    }

    const wasAccepted = reservation.status === ReservationStatus.ACCEPTED;

    const updatedReservation = await prisma.reservation.update({
      where: { id: Number(id) },
      data: { status: ReservationStatus.CANCELED },
    });

    if (wasAccepted && reservation.type === ReservationType.ACHAT) {
      await prisma.vehicle.update({
        where: { id: reservation.vehicleId },
        data: { status: VehicleStatus.DISPONIBLE },
      });
    }

    if (wasAccepted) {
      await prisma.vehicleStats.update({
        where: { vehicleId: reservation.vehicleId },
        data: { reservations: { decrement: 1 } },
      });
    }

    // Notifications
    await notifyUser(
      reservation.userId,
      'Réservation annulée',
      `Votre réservation du véhicule ${reservation.vehicle.marqueRef?.name ?? 'Marque inconnue'} ${reservation.vehicle.model ?? ''} a été annulée.`,
      NotificationType.RESERVATION,
      { reservationId: reservation.id }
    );

    if (reservation.vehicle.parkingId) {
      await notifyParkingOwner(
        reservation.vehicle.parkingId,
        'Réservation annulée',
        `La réservation du véhicule ${reservation.vehicle.marqueRef?.name ?? 'Marque inconnue'} ${reservation.vehicle.model ?? ''} a été annulée.`,
        NotificationType.RESERVATION,
        { reservationId: reservation.id }
      );
    }

    return res.json({ message: 'Réservation annulée avec succès', reservation: updatedReservation });
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
      include: { vehicle: { include: { marqueRef: true } }, user: true },
    });

    await notifyUser(
      updated.userId,
      'Réservation mise à jour',
      `Votre réservation du véhicule ${updated.vehicle.marqueRef?.name ?? 'Marque inconnue'} ${updated.vehicle.model ?? ''} a été modifiée par l’administrateur.`,
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