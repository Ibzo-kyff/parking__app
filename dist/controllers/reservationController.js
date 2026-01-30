"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReservation = exports.getReservation = exports.getUserReservations = exports.getAllReservationsForParking = exports.getAllReservations = exports.updateReservationStatus = exports.createReservation = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const sendNotification_1 = require("../utils/sendNotification");
const prisma = new client_1.PrismaClient();
const reservationSchema = zod_1.z
    .object({
    vehicleId: zod_1.z.number(),
    dateDebut: zod_1.z.string().datetime().optional().nullable(),
    dateFin: zod_1.z.string().datetime().optional().nullable(),
    type: zod_1.z.nativeEnum(client_1.ReservationType),
    motifLocation: zod_1.z.string().optional().nullable(),
    localisation: zod_1.z.enum(['BAMAKO', 'HORS_BAMAKO']).optional().nullable(),
    conditionsAcceptees: zod_1.z.boolean().optional().nullable(),
})
    .refine((data) => {
    if (data.type === client_1.ReservationType.LOCATION) {
        // Validation des dates pour location
        if (!data.dateDebut || !data.dateFin)
            return false;
        const startDate = new Date(data.dateDebut);
        const endDate = new Date(data.dateFin);
        // Permettre une réservation d'au moins 1 jour (24h)
        // La date de fin doit être après la date de début
        // Même si c'est le même jour, la fin doit être après le début
        return startDate < endDate;
    }
    return true;
}, {
    message: 'Pour une location, les dates de début et de fin sont requises et la date de fin doit être après la date de début',
})
    .refine((data) => {
    if (data.type === client_1.ReservationType.LOCATION) {
        // Vérifier que le motif est présent
        if (!data.motifLocation || data.motifLocation.trim() === '')
            return false;
        // Vérifier que la localisation est présente
        if (!data.localisation)
            return false;
        // Vérifier que les conditions sont acceptées
        if (!data.conditionsAcceptees)
            return false;
    }
    return true;
}, {
    message: 'Pour une location, le motif, la localisation et l\'acceptation des conditions sont obligatoires',
    path: ['type'],
});
const createReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Non autorisé' });
        const data = reservationSchema.parse(req.body);
        const { vehicleId, dateDebut, dateFin, type, motifLocation, localisation, conditionsAcceptees } = data;
        const userId = req.user.id;
        const startDate = dateDebut ? new Date(dateDebut) : null;
        const endDate = dateFin ? new Date(dateFin) : null;
        // Récupérer le véhicule avec ses réservations
        const vehicle = yield prisma.vehicle.findUnique({
            where: { id: vehicleId },
            include: {
                reservations: {
                    where: {
                        status: { in: [client_1.ReservationStatus.PENDING, client_1.ReservationStatus.ACCEPTED] },
                    },
                },
                marqueRef: true,
            },
        });
        if (!vehicle)
            return res.status(404).json({ message: 'Véhicule non trouvé' });
        // Vérifications de disponibilité générale
        if (type === client_1.ReservationType.ACHAT && !vehicle.forSale)
            return res.status(400).json({ message: "Ce véhicule n'est pas destiné à la vente" });
        if (type === client_1.ReservationType.LOCATION && !vehicle.forRent)
            return res.status(400).json({ message: "Ce véhicule n'est pas destiné à la location" });
        if (vehicle.status !== client_1.VehicleStatus.DISPONIBLE)
            return res.status(400).json({ message: "Ce véhicule n'est pas disponible" });
        // Vérification pour l'achat : pas de demande d'achat en cours
        if (type === client_1.ReservationType.ACHAT) {
            const existingPurchaseRequest = vehicle.reservations.find((r) => r.type === client_1.ReservationType.ACHAT);
            if (existingPurchaseRequest) {
                return res.status(400).json({
                    message: 'Ce véhicule fait déjà l\'objet d\'une demande d\'achat en cours. Vous ne pouvez pas en faire une autre tant que celle-ci n\'est pas traitée.',
                });
            }
        }
        // Vérification des conflits de dates pour les locations
        if (type === client_1.ReservationType.LOCATION && startDate && endDate) {
            const conflict = yield prisma.reservation.findFirst({
                where: {
                    vehicleId,
                    status: client_1.ReservationStatus.ACCEPTED,
                    type: client_1.ReservationType.LOCATION,
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
        const commission = type === client_1.ReservationType.LOCATION ? vehicle.prix * 0.1 : null;
        // Créer la réservation avec tous les champs
        const reservation = yield prisma.reservation.create({
            data: {
                userId,
                vehicleId,
                dateDebut: startDate,
                dateFin: endDate,
                type,
                motifLocation: type === client_1.ReservationType.LOCATION ? motifLocation : null,
                localisation: type === client_1.ReservationType.LOCATION ? localisation : null,
                conditionsAcceptees: type === client_1.ReservationType.LOCATION ? conditionsAcceptees : null,
                commission,
                status: client_1.ReservationStatus.PENDING,
            },
            include: {
                vehicle: { include: { marqueRef: true } },
                user: true,
            },
        });
        // Notifications
        yield (0, sendNotification_1.notifyUser)(userId, 'Demande de réservation envoyée', type === client_1.ReservationType.ACHAT
            ? `Votre demande d'achat du véhicule ${(_b = (_a = vehicle.marqueRef) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : ''} ${vehicle.model} est en attente de confirmation.`
            : `Votre demande de location du véhicule ${(_d = (_c = vehicle.marqueRef) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : ''} ${vehicle.model} est en attente.`, client_1.NotificationType.RESERVATION, { reservationId: reservation.id, vehicleId });
        if (vehicle.parkingId) {
            yield (0, sendNotification_1.notifyParkingOwner)(vehicle.parkingId, 'Nouvelle demande de réservation', `Nouvelle demande de ${type.toLowerCase()} pour le véhicule ${(_f = (_e = vehicle.marqueRef) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : ''} ${vehicle.model}.`, client_1.NotificationType.RESERVATION, { reservationId: reservation.id, vehicleId });
        }
        return res.status(201).json(reservation);
    }
    catch (err) {
        console.error('Erreur création réservation:', err);
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.createReservation = createReservation;
const updateReservationStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Non autorisé' });
        const { id } = req.params;
        const { status, reason } = req.body;
        // Validation du statut
        const validStatuses = Object.values(client_1.ReservationStatus);
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Statut invalide',
                validStatuses
            });
        }
        // Trouver la réservation
        const reservation = yield prisma.reservation.findUnique({
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
            const parking = yield prisma.parking.findUnique({
                where: { userId: req.user.id },
            });
            hasPermission = parking != null && reservation.vehicle.parkingId === parking.id;
        }
        else if (req.user.role === 'CLIENT') {
            hasPermission = reservation.userId === req.user.id;
            // Les clients ne peuvent que cancel leurs propres réservations
            if (hasPermission && status !== client_1.ReservationStatus.CANCELED) {
                return res.status(403).json({ message: 'Vous ne pouvez qu\'annuler vos propres réservations' });
            }
        }
        if (!hasPermission)
            return res.status(403).json({ message: 'Accès non autorisé' });
        // Logique de validation selon le statut
        if (status === client_1.ReservationStatus.ACCEPTED) {
            // Seul le parking peut accepter
            if (req.user.role !== 'PARKING' && req.user.role !== 'ADMIN') {
                return res.status(403).json({ message: 'Seul le parking peut accepter une réservation' });
            }
            if (reservation.status !== client_1.ReservationStatus.PENDING) {
                return res.status(400).json({ message: 'Seules les réservations en attente peuvent être acceptées' });
            }
            // Vérifier les conflits de dates pour les locations
            if (reservation.type === client_1.ReservationType.LOCATION && reservation.dateDebut && reservation.dateFin) {
                const conflict = yield prisma.reservation.findFirst({
                    where: {
                        vehicleId: reservation.vehicleId,
                        status: client_1.ReservationStatus.ACCEPTED,
                        id: { not: reservation.id },
                        type: client_1.ReservationType.LOCATION,
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
        else if (status === client_1.ReservationStatus.CANCELED) {
            // Vérifier les règles d'annulation
            if (reservation.status === client_1.ReservationStatus.CANCELED) {
                return res.status(400).json({ message: 'Cette réservation est déjà annulée' });
            }
            // Pour les locations, vérifier le délai de 12h (réduit de 24h)
            if (req.user.role === 'CLIENT' && reservation.type === client_1.ReservationType.LOCATION && reservation.dateDebut) {
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
        else if (status === client_1.ReservationStatus.PENDING) {
            return res.status(400).json({ message: 'Impossible de revenir au statut PENDING' });
        }
        // Mettre à jour la réservation
        const updatedReservation = yield prisma.reservation.update({
            where: { id: Number(id) },
            data: { status },
            include: {
                vehicle: { include: { marqueRef: true } },
                user: true
            },
        });
        // Gérer les effets secondaires
        const wasAccepted = reservation.status === client_1.ReservationStatus.ACCEPTED;
        const willBeAccepted = status === client_1.ReservationStatus.ACCEPTED;
        // Mettre à jour le statut du véhicule pour les achats
        if (reservation.type === client_1.ReservationType.ACHAT) {
            if (willBeAccepted) {
                yield prisma.vehicle.update({
                    where: { id: reservation.vehicleId },
                    data: { status: client_1.VehicleStatus.INDISPONIBLE },
                });
            }
            else if (wasAccepted && status !== client_1.ReservationStatus.ACCEPTED) {
                yield prisma.vehicle.update({
                    where: { id: reservation.vehicleId },
                    data: { status: client_1.VehicleStatus.DISPONIBLE },
                });
            }
        }
        // Mettre à jour les statistiques
        if (wasAccepted && !willBeAccepted) {
            // Décrémenter si on passe d'ACCEPTED à autre chose
            yield prisma.vehicleStats.update({
                where: { vehicleId: reservation.vehicleId },
                data: { reservations: { decrement: 1 } },
            });
        }
        else if (!wasAccepted && willBeAccepted) {
            // Incrémenter si on passe à ACCEPTED
            yield prisma.vehicleStats.upsert({
                where: { vehicleId: reservation.vehicleId },
                update: { reservations: { increment: 1 } },
                create: { vehicleId: reservation.vehicleId, reservations: 1 },
            });
        }
        // Envoyer les notifications appropriées
        yield sendStatusChangeNotification(reservation, status, reason, req.user.role);
        return res.json(updatedReservation);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.updateReservationStatus = updateReservationStatus;
// Fonction helper pour les notifications
function sendStatusChangeNotification(reservation, newStatus, reason, changedByRole) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const vehicleName = `${(_b = (_a = reservation.vehicle.marqueRef) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'Marque inconnue'} ${(_c = reservation.vehicle.model) !== null && _c !== void 0 ? _c : ''}`;
        let title = '';
        let message = '';
        switch (newStatus) {
            case client_1.ReservationStatus.ACCEPTED:
                title = 'Réservation acceptée';
                if (reservation.type === client_1.ReservationType.ACHAT) {
                    message = `Votre achat du véhicule ${vehicleName} a été accepté.`;
                }
                else {
                    // Formatter les dates pour la location
                    const startDate = reservation.dateDebut ? new Date(reservation.dateDebut).toLocaleDateString('fr-FR') : '';
                    const endDate = reservation.dateFin ? new Date(reservation.dateFin).toLocaleDateString('fr-FR') : '';
                    message = `Votre location du véhicule ${vehicleName} a été acceptée du ${startDate} au ${endDate}.`;
                }
                break;
            case client_1.ReservationStatus.CANCELED:
                title = 'Réservation annulée';
                const byWho = changedByRole === 'CLIENT' ? 'Vous avez annulé' : 'Votre réservation a été annulée';
                message = `${byWho} pour le véhicule ${vehicleName}${reason ? ` : ${reason}` : ''}.`;
                break;
            default:
                return;
        }
        // Notifier l'utilisateur
        yield (0, sendNotification_1.notifyUser)(reservation.userId, title, message, client_1.NotificationType.RESERVATION, { reservationId: reservation.id, vehicleId: reservation.vehicleId });
        // Notifier le parking si ce n'est pas lui qui a fait le changement
        if (reservation.vehicle.parkingId && changedByRole !== 'PARKING') {
            let parkingMessage = '';
            switch (newStatus) {
                case client_1.ReservationStatus.CANCELED:
                    parkingMessage = `La réservation du véhicule ${vehicleName} a été annulée par ${changedByRole === 'CLIENT' ? 'le client' : 'l\'administrateur'}${reason ? ` : ${reason}` : ''}.`;
                    break;
                // Ajouter d'autres cas si nécessaire
            }
            if (parkingMessage) {
                yield (0, sendNotification_1.notifyParkingOwner)(reservation.vehicle.parkingId, `Réservation ${newStatus.toLowerCase()}`, parkingMessage, client_1.NotificationType.RESERVATION, { reservationId: reservation.id });
            }
        }
    });
}
const getAllReservations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'ADMIN')
            return res.status(403).json({ message: 'Accès non autorisé' });
        const reservations = yield prisma.reservation.findMany({
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
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.getAllReservations = getAllReservations;
const getAllReservationsForParking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'PARKING')
            return res.status(403).json({ message: 'Accès non autorisé' });
        const parking = yield prisma.parking.findUnique({
            where: { userId: req.user.id },
        });
        if (!parking)
            return res.status(404).json({ message: 'Parking non trouvé' });
        const reservations = yield prisma.reservation.findMany({
            where: { vehicle: { parkingId: parking.id } },
            include: {
                user: { select: { id: true, nom: true, prenom: true, email: true } },
                vehicle: { include: { marqueRef: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(reservations);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.getAllReservationsForParking = getAllReservationsForParking;
const getUserReservations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Non autorisé' });
        const reservations = yield prisma.reservation.findMany({
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
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.getUserReservations = getUserReservations;
const getReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Non autorisé' });
        const { id } = req.params;
        const reservation = yield prisma.reservation.findUnique({
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
            const parking = yield prisma.parking.findUnique({
                where: { userId: req.user.id },
            });
            if (!parking || reservation.vehicle.parkingId !== parking.id)
                return res.status(403).json({ message: 'Accès non autorisé' });
        }
        return res.json(reservation);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.getReservation = getReservation;
const updateReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        if (!req.user || req.user.role !== 'ADMIN')
            return res.status(403).json({ message: 'Accès non autorisé' });
        const { id } = req.params;
        const data = reservationSchema.partial().parse(req.body);
        const existing = yield prisma.reservation.findUnique({
            where: { id: Number(id) },
        });
        if (!existing)
            return res.status(404).json({ message: 'Réservation non trouvée' });
        const updated = yield prisma.reservation.update({
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
        yield (0, sendNotification_1.notifyUser)(updated.userId, 'Réservation mise à jour', `Votre réservation du véhicule ${(_b = (_a = updated.vehicle.marqueRef) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'Marque inconnue'} ${(_c = updated.vehicle.model) !== null && _c !== void 0 ? _c : ''} a été modifiée par l'administrateur.`, client_1.NotificationType.MESSAGE, { reservationId: updated.id });
        return res.json(updated);
    }
    catch (err) {
        console.error(err);
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.updateReservation = updateReservation;
