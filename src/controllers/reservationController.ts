import { Request, Response } from 'express';
import { PrismaClient, ReservationType, VehicleStatus } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

// Schéma de validation
const reservationSchema = z.object({
  vehicleId: z.number(),
  dateDebut: z.string().datetime().optional().nullable(), // Optionnel et peut être null
  dateFin: z.string().datetime().optional().nullable(),   // Optionnel et peut être null
  type: z.nativeEnum(ReservationType),
}).refine((data) => {
  // Vérification : Si type est LOCATION, dateDebut et dateFin doivent être fournis
  if (data.type === ReservationType.LOCATION) {
    return (
      data.dateDebut !== null &&
      data.dateDebut !== undefined &&
      data.dateFin !== null &&
      data.dateFin !== undefined &&
      new Date(data.dateDebut) < new Date(data.dateFin)
    );
  }
  // Pour ACHAT, les dates peuvent être null
  return true;
}, {
  message: 'Les dates de début et de fin sont requises pour une location et doivent être valides',
});

// Créer une réservation
export const createReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const data = reservationSchema.parse(req.body);
    const { vehicleId, dateDebut, dateFin, type } = data;
    const userId = req.user.id;

    let startDate = dateDebut ? new Date(dateDebut) : null;
    let endDate = dateFin ? new Date(dateFin) : null;

    // Vérification spécifique pour LOCATION
    if (type === ReservationType.LOCATION && (!startDate || !endDate || startDate >= endDate)) {
      return res.status(400).json({ message: 'La date de fin doit être après la date de début pour une location' });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { reservations: true },
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Véhicule non trouvé' });
    }

    // Vérifier les contraintes transactionnelles
    if (type === ReservationType.ACHAT && !vehicle.forSale) {
      return res.status(400).json({ message: 'Ce véhicule n\'est pas destiné à la vente' });
    }
    if (type === ReservationType.LOCATION && !vehicle.forRent) {
      return res.status(400).json({ message: 'Ce véhicule n\'est pas destiné à la location' });
    }

    if (vehicle.status !== VehicleStatus.DISPONIBLE) {
      return res.status(400).json({ message: 'Ce véhicule n\'est pas disponible' });
    }

    // Vérifier les conflits uniquement pour LOCATION
    if (type === ReservationType.LOCATION) {
      const conflictingReservation = await prisma.reservation.findFirst({
        where: {
          vehicleId,
          OR: [
            {
              dateDebut: { lte: endDate! },
              dateFin: { gte: startDate! },
            },
          ],
        },
      });

      if (conflictingReservation) {
        return res.status(400).json({ message: 'Le véhicule est déjà réservé pour cette période' });
      }
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
      },
      include: {
        vehicle: true,
        user: true,
      },
    });

    // Mettre à jour le statut opérationnel
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status: type === ReservationType.ACHAT ? VehicleStatus.INDISPONIBLE : VehicleStatus.DISPONIBLE,
      },
    });

    await prisma.vehicleStats.upsert({
      where: { vehicleId },
      update: { reservations: { increment: 1 } },
      create: { vehicleId, reservations: 1 },
    });

    return res.status(201).json(reservation);
  } catch (err) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Obtenir toutes les réservations (pour ADMIN)
export const getAllReservations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const reservations = await prisma.reservation.findMany({
      include: {
        user: true,
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(reservations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Obtenir toutes les réservations (pour PARKING)
export const getAllReservationsForParking = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'PARKING') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const parking = await prisma.parking.findUnique({
      where: { userId: req.user.id },
    });

    if (!parking) {
      return res.status(404).json({ message: 'Parking non trouvé pour cet utilisateur' });
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        vehicle: { parkingId: parking.id },
      },
      include: {
        user: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(reservations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Obtenir les réservations d'un utilisateur (CLIENT)
export const getUserReservations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const reservations = await prisma.reservation.findMany({
      where: { userId: req.user.id },
      include: { vehicle: true },
      orderBy: { dateDebut: 'desc' },
    });

    return res.json(reservations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Obtenir une réservation spécifique
export const getReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const { id } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { id: Number(id) },
      include: { vehicle: true, user: true },
    });

    if (!reservation) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }

    // Vérifications selon le rôle
    if (req.user.role === 'CLIENT' && reservation.userId !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    if (req.user.role === 'PARKING') {
      const parking = await prisma.parking.findUnique({
        where: { userId: req.user.id },
      });

      if (!parking || reservation.vehicle.parkingId !== parking.id) {
        return res.status(403).json({ message: 'Accès non autorisé' });
      }
    }

    return res.json(reservation);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Annuler une réservation
export const cancelReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

    const { id } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { id: Number(id) },
      include: { vehicle: true },
    });

    if (!reservation) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }

    // Permissions
    if (req.user.role === 'CLIENT' && reservation.userId !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    if (req.user.role === 'PARKING') {
      const parking = await prisma.parking.findUnique({
        where: { userId: req.user.id },
      });

      if (!parking || reservation.vehicle.parkingId !== parking.id) {
        return res.status(403).json({ message: 'Accès non autorisé' });
      }
    }

    // Ne vérifier les 24h que pour les locations
    if (reservation.type === ReservationType.LOCATION && reservation.dateDebut) {
      const now = new Date();
      const minCancelTime = new Date(reservation.dateDebut);
      minCancelTime.setDate(minCancelTime.getDate() - 1);

      if (now > minCancelTime) {
        return res.status(400).json({ message: 'Annulation impossible moins de 24h avant' });
      }
    }

    await prisma.reservation.delete({
      where: { id: Number(id) },
    });

    // Restaurer le statut opérationnel
    await prisma.vehicle.update({
      where: { id: reservation.vehicleId },
      data: { status: VehicleStatus.DISPONIBLE },
    });

    await prisma.vehicleStats.update({
      where: { vehicleId: reservation.vehicleId },
      data: { reservations: { decrement: 1 } },
    });

    return res.json({ message: 'Réservation annulée avec succès' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Mettre à jour une réservation (ADMIN)
export const updateReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const { id } = req.params;
    const data = reservationSchema.partial().parse(req.body);

    const existingReservation = await prisma.reservation.findUnique({
      where: { id: Number(id) },
    });

    if (!existingReservation) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }

    const updatedReservation = await prisma.reservation.update({
      where: { id: Number(id) },
      data,
      include: { vehicle: true, user: true },
    });
    return res.json(updatedReservation);
  } catch (err) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};





// import { Request, Response } from 'express';
// import {
//   PrismaClient,
//   ReservationType,
//   VehicleStatus,
//   NotificationType,
// } from '@prisma/client';
// import { z } from 'zod';
// import { AuthRequest } from '../middleware/authMiddleware';

// // Import des notifications
// import { notifyUser, notifyParkingOwner } from '../utils/sendNotification';

// const prisma = new PrismaClient();

// // === SCHÉMA DE VALIDATION ===
// const reservationSchema = z
//   .object({
//     vehicleId: z.number(),
//     dateDebut: z.string().datetime().optional().nullable(),
//     dateFin: z.string().datetime().optional().nullable(),
//     type: z.nativeEnum(ReservationType),
//   })
//   .refine(
//     (data) => {
//       if (data.type === ReservationType.LOCATION) {
//         return (
//           data.dateDebut !== null &&
//           data.dateDebut !== undefined &&
//           data.dateFin !== null &&
//           data.dateFin !== undefined &&
//           new Date(data.dateDebut) < new Date(data.dateFin)
//         );
//       }
//       return true;
//     },
//     {
//       message:
//         'Les dates de début et de fin sont requises pour une location et doivent être valides',
//     }
//   );

// // === FONCTION DE FORMATAGE DE DATE ===
// const formatDate = (date: Date | null): string => {
//   if (!date) return 'N/A';
//   return date.toLocaleDateString('fr-FR', {
//     day: '2-digit',
//     month: '2-digit',
//     year: 'numeric',
//   });
// };

// // === CRÉER UNE RÉSERVATION ===
// export const createReservation = async (req: AuthRequest, res: Response) => {
//   try {
//     if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

//     const data = reservationSchema.parse(req.body);
//     const { vehicleId, dateDebut, dateFin, type } = data;
//     const userId = req.user.id;

//     const startDate = dateDebut ? new Date(dateDebut) : null;
//     const endDate = dateFin ? new Date(dateFin) : null;

//     // Validation supplémentaire pour LOCATION
//     if (
//       type === ReservationType.LOCATION &&
//       (!startDate || !endDate || startDate >= endDate)
//     ) {
//       return res
//         .status(400)
//         .json({ message: 'La date de fin doit être après la date de début' });
//     }

//     // Récupérer le véhicule avec parking
//     const vehicle = await prisma.vehicle.findUnique({
//       where: { id: vehicleId },
//       include: {
//         reservations: true,
//         parking: true,
//       },
//     });

//     if (!vehicle) {
//       return res.status(404).json({ message: 'Véhicule non trouvé' });
//     }

//     // Vérifications métier
//     if (type === ReservationType.ACHAT && !vehicle.forSale) {
//       return res
//         .status(400)
//         .json({ message: "Ce véhicule n'est pas destiné à la vente" });
//     }
//     if (type === ReservationType.LOCATION && !vehicle.forRent) {
//       return res
//         .status(400)
//         .json({ message: "Ce véhicule n'est pas destiné à la location" });
//     }
//     if (vehicle.status !== VehicleStatus.DISPONIBLE) {
//       return res
//         .status(400)
//         .json({ message: 'Ce véhicule n\'est pas disponible' });
//     }

//     // Vérifier les conflits (uniquement pour LOCATION)
//     if (type === ReservationType.LOCATION) {
//       const conflictingReservation = await prisma.reservation.findFirst({
//         where: {
//           vehicleId,
//           OR: [
//             {
//               dateDebut: { lte: endDate! },
//               dateFin: { gte: startDate! },
//             },
//           ],
//         },
//       });

//       if (conflictingReservation) {
//         return res
//           .status(400)
//           .json({ message: 'Le véhicule est déjà réservé pour cette période' });
//       }
//     }

//     const commission =
//       type === ReservationType.LOCATION ? vehicle.prix * 0.1 : null;

//     // Créer la réservation
//     const reservation = await prisma.reservation.create({
//       data: {
//         userId,
//         vehicleId,
//         dateDebut: startDate,
//         dateFin: endDate,
//         type,
//         commission,
//       },
//       include: {
//         vehicle: true,
//         user: true,
//       },
//     });

//     // Mettre à jour le statut du véhicule
//     await prisma.vehicle.update({
//       where: { id: vehicleId },
//       data: {
//         status:
//           type === ReservationType.ACHAT
//             ? VehicleStatus.INDISPONIBLE
//             : VehicleStatus.DISPONIBLE,
//       },
//     });

//     // Mettre à jour les stats
//     await prisma.vehicleStats.upsert({
//       where: { vehicleId },
//       update: { reservations: { increment: 1 } },
//       create: { vehicleId, reservations: 1 },
//     });

//     // === NOTIFICATIONS PUSH ===
//     const period =
//       type === ReservationType.LOCATION
//         ? `du ${formatDate(startDate)} au ${formatDate(endDate)}`
//         : 'immédiatement';

//     // → Notifier le client
//     await notifyUser(
//       userId,
//       'Réservation confirmée',
//       `Votre ${type === ReservationType.ACHAT ? 'achat' : 'location'
//       } est confirmée ${period}.`,
//       NotificationType.RESERVATION,
//       { reservationId: reservation.id }
//     ).catch((err) =>
//       console.error('Échec notification client:', err.message)
//     );

//     // → Notifier le propriétaire du parking
//     if (vehicle.parkingId) {
//       await notifyParkingOwner(
//         vehicle.parkingId,
//         'Nouvelle réservation',
//         `${req.user.nom} ${req.user.prenom} a réservé votre véhicule ${period}.`,
//         NotificationType.RESERVATION,
//         { reservationId: reservation.id, userId }
//       ).catch((err) =>
//         console.error('Échec notification parking:', err.message)
//       );
//     }

//     return res.status(201).json(reservation);
//   } catch (err) {
//     console.error('Erreur création réservation:', err);
//     if (err instanceof z.ZodError) {
//       return res
//         .status(400)
//         .json({ message: 'Données invalides', errors: err.issues });
//     }
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// };

// // === OBTENIR TOUTES LES RÉSERVATIONS (ADMIN) ===
// export const getAllReservations = async (req: AuthRequest, res: Response) => {
//   try {
//     if (!req.user || req.user.role !== 'ADMIN') {
//       return res.status(403).json({ message: 'Accès non autorisé' });
//     }

//     const reservations = await prisma.reservation.findMany({
//       include: { user: true, vehicle: true },
//       orderBy: { createdAt: 'desc' },
//     });

//     return res.json(reservations);
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// };

// // === OBTENIR LES RÉSERVATIONS DU PARKING ===
// export const getAllReservationsForParking = async (
//   req: AuthRequest,
//   res: Response
// ) => {
//   try {
//     if (!req.user || req.user.role !== 'PARKING') {
//       return res.status(403).json({ message: 'Accès non autorisé' });
//     }

//     const parking = await prisma.parking.findUnique({
//       where: { userId: req.user.id },
//     });

//     if (!parking) {
//       return res
//         .status(404)
//         .json({ message: 'Parking non trouvé pour cet utilisateur' });
//     }

//     const reservations = await prisma.reservation.findMany({
//       where: { vehicle: { parkingId: parking.id } },
//       include: {
//         user: { select: { id: true, nom: true, prenom: true, email: true } },
//         vehicle: true,
//       },
//       orderBy: { createdAt: 'desc' },
//     });

//     return res.json(reservations);
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// };

// // === OBTENIR LES RÉSERVATIONS DU CLIENT ===
// export const getUserReservations = async (req: AuthRequest, res: Response) => {
//   try {
//     if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

//     const reservations = await prisma.reservation.findMany({
//       where: { userId: req.user.id },
//       include: { vehicle: true },
//       orderBy: { dateDebut: 'desc' },
//     });

//     return res.json(reservations);
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// };

// // === OBTENIR UNE RÉSERVATION SPÉCIFIQUE ===
// export const getReservation = async (req: AuthRequest, res: Response) => {
//   try {
//     if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

//     const { id } = req.params;
//     const reservation = await prisma.reservation.findUnique({
//       where: { id: Number(id) },
//       include: { vehicle: true, user: true },
//     });

//     if (!reservation) {
//       return res.status(404).json({ message: 'Réservation non trouvée' });
//     }

//     // Vérification des droits
//     if (req.user.role === 'CLIENT' && reservation.userId !== req.user.id) {
//       return res.status(403).json({ message: 'Accès non autorisé' });
//     }

//     if (req.user.role === 'PARKING') {
//       const parking = await prisma.parking.findUnique({
//         where: { userId: req.user.id },
//       });
//       if (!parking || reservation.vehicle.parkingId !== parking.id) {
//         return res.status(403).json({ message: 'Accès non autorisé' });
//       }
//     }

//     return res.json(reservation);
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// };

// // === ANNULER UNE RÉSERVATION ===
// export const cancelReservation = async (req: AuthRequest, res: Response) => {
//   try {
//     if (!req.user) return res.status(401).json({ message: 'Non autorisé' });

//     const { id } = req.params;
//     const reservation = await prisma.reservation.findUnique({
//       where: { id: Number(id) },
//       include: {
//         vehicle: { include: { parking: true } },
//         user: true,
//       },
//     });

//     if (!reservation) {
//       return res.status(404).json({ message: 'Réservation non trouvée' });
//     }

//     // Vérification des droits
//     if (req.user.role === 'CLIENT' && reservation.userId !== req.user.id) {
//       return res.status(403).json({ message: 'Accès non autorisé' });
//     }
//     if (req.user.role === 'PARKING') {
//       const parking = await prisma.parking.findUnique({
//         where: { userId: req.user.id },
//       });
//       if (!parking || reservation.vehicle.parkingId !== parking.id) {
//         return res.status(403).json({ message: 'Accès non autorisé' });
//       }
//     }

//     // Règle des 24h pour les locations
//     if (reservation.type === ReservationType.LOCATION && reservation.dateDebut) {
//       const now = new Date();
//       const minCancelTime = new Date(reservation.dateDebut);
//       minCancelTime.setDate(minCancelTime.getDate() - 1);

//       if (now > minCancelTime) {
//         return res
//           .status(400)
//           .json({ message: 'Annulation impossible moins de 24h avant' });
//       }
//     }

//     // Supprimer la réservation
//     await prisma.reservation.delete({ where: { id: Number(id) } });

//     // Restaurer le véhicule
//     await prisma.vehicle.update({
//       where: { id: reservation.vehicleId },
//       data: { status: VehicleStatus.DISPONIBLE },
//     });

//     // Mettre à jour les stats
//     await prisma.vehicleStats.update({
//       where: { vehicleId: reservation.vehicleId },
//       data: { reservations: { decrement: 1 } },
//     });

//     // === NOTIFICATIONS D'ANNULATION ===
//     const period =
//       reservation.type === ReservationType.LOCATION
//         ? `prévue du ${formatDate(reservation.dateDebut)} au ${formatDate(
//           reservation.dateFin
//         )}`
//         : '';

//     const canceler =
//       req.user.role === 'CLIENT'
//         ? `${req.user.nom} ${req.user.prenom}`
//         : 'le système';

//     // → Notifier le client
//     await notifyUser(
//       reservation.userId,
//       'Réservation annulée',
//       `Votre réservation a été annulée avec succès ${period}.`,
//       NotificationType.CANCEL,
//       { reservationId: reservation.id }
//     ).catch(() => { });

//     // → Notifier le parking
//     if (reservation.vehicle.parkingId) {
//       await notifyParkingOwner(
//         reservation.vehicle.parkingId,
//         'Réservation annulée',
//         `La réservation de ${canceler} a été annulée ${period}.`,
//         NotificationType.CANCEL,
//         { reservationId: reservation.id }
//       ).catch(() => { });
//     }

//     return res.json({ message: 'Réservation annulée avec succès' });
//   } catch (err) {
//     console.error('Erreur annulation:', err);
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// };

// // === METTRE À JOUR UNE RÉSERVATION (ADMIN) ===
// export const updateReservation = async (req: AuthRequest, res: Response) => {
//   try {
//     if (!req.user || req.user.role !== 'ADMIN') {
//       return res.status(403).json({ message: 'Accès non autorisé' });
//     }

//     const { id } = req.params;
//     const data = reservationSchema.partial().parse(req.body);

//     const existing = await prisma.reservation.findUnique({
//       where: { id: Number(id) },
//     });

//     if (!existing) {
//       return res.status(404).json({ message: 'Réservation non trouvée' });
//     }

//     const updated = await prisma.reservation.update({
//       where: { id: Number(id) },
//       data,
//       include: { vehicle: true, user: true },
//     });

//     return res.json(updated);
//   } catch (err) {
//     console.error(err);
//     if (err instanceof z.ZodError) {
//       return res
//         .status(400)
//         .json({ message: 'Données invalides', errors: err.issues });
//     }
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// };