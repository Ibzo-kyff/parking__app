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
exports.updateReservation = exports.cancelReservation = exports.getReservation = exports.getUserReservations = exports.getAllReservationsForParking = exports.getAllReservations = exports.createReservation = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
// Schéma de validation
const reservationSchema = zod_1.z.object({
    vehicleId: zod_1.z.number(),
    dateDebut: zod_1.z.string().datetime().optional().nullable(), // Optionnel et peut être null
    dateFin: zod_1.z.string().datetime().optional().nullable(), // Optionnel et peut être null
    type: zod_1.z.nativeEnum(client_1.ReservationType),
}).refine((data) => {
    // Vérification : Si type est LOCATION, dateDebut et dateFin doivent être fournis
    if (data.type === client_1.ReservationType.LOCATION) {
        return (data.dateDebut !== null &&
            data.dateDebut !== undefined &&
            data.dateFin !== null &&
            data.dateFin !== undefined &&
            new Date(data.dateDebut) < new Date(data.dateFin));
    }
    // Pour ACHAT, les dates peuvent être null
    return true;
}, {
    message: 'Les dates de début et de fin sont requises pour une location et doivent être valides',
});
// Créer une réservation
const createReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Non autorisé' });
        const data = reservationSchema.parse(req.body);
        const { vehicleId, dateDebut, dateFin, type } = data;
        const userId = req.user.id;
        let startDate = dateDebut ? new Date(dateDebut) : null;
        let endDate = dateFin ? new Date(dateFin) : null;
        // Vérification spécifique pour LOCATION
        if (type === client_1.ReservationType.LOCATION && (!startDate || !endDate || startDate >= endDate)) {
            return res.status(400).json({ message: 'La date de fin doit être après la date de début pour une location' });
        }
        const vehicle = yield prisma.vehicle.findUnique({
            where: { id: vehicleId },
            include: { reservations: true },
        });
        if (!vehicle) {
            return res.status(404).json({ message: 'Véhicule non trouvé' });
        }
        // Vérifier les contraintes transactionnelles
        if (type === client_1.ReservationType.ACHAT && !vehicle.forSale) {
            return res.status(400).json({ message: 'Ce véhicule n\'est pas destiné à la vente' });
        }
        if (type === client_1.ReservationType.LOCATION && !vehicle.forRent) {
            return res.status(400).json({ message: 'Ce véhicule n\'est pas destiné à la location' });
        }
        if (vehicle.status !== client_1.VehicleStatus.DISPONIBLE) {
            return res.status(400).json({ message: 'Ce véhicule n\'est pas disponible' });
        }
        // Vérifier les conflits uniquement pour LOCATION
        if (type === client_1.ReservationType.LOCATION) {
            const conflictingReservation = yield prisma.reservation.findFirst({
                where: {
                    vehicleId,
                    OR: [
                        {
                            dateDebut: { lte: endDate },
                            dateFin: { gte: startDate },
                        },
                    ],
                },
            });
            if (conflictingReservation) {
                return res.status(400).json({ message: 'Le véhicule est déjà réservé pour cette période' });
            }
        }
        const commission = type === client_1.ReservationType.LOCATION ? vehicle.prix * 0.1 : null;
        const reservation = yield prisma.reservation.create({
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
        yield prisma.vehicle.update({
            where: { id: vehicleId },
            data: {
                status: type === client_1.ReservationType.ACHAT ? client_1.VehicleStatus.INDISPONIBLE : client_1.VehicleStatus.DISPONIBLE,
            },
        });
        yield prisma.vehicleStats.upsert({
            where: { vehicleId },
            update: { reservations: { increment: 1 } },
            create: { vehicleId, reservations: 1 },
        });
        return res.status(201).json(reservation);
    }
    catch (err) {
        console.error(err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.createReservation = createReservation;
// Obtenir toutes les réservations (pour ADMIN)
const getAllReservations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Accès non autorisé' });
        }
        const reservations = yield prisma.reservation.findMany({
            include: {
                user: true,
                vehicle: true,
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
// Obtenir toutes les réservations (pour PARKING)
const getAllReservationsForParking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'PARKING') {
            return res.status(403).json({ message: 'Accès non autorisé' });
        }
        const parking = yield prisma.parking.findUnique({
            where: { userId: req.user.id },
        });
        if (!parking) {
            return res.status(404).json({ message: 'Parking non trouvé pour cet utilisateur' });
        }
        const reservations = yield prisma.reservation.findMany({
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
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.getAllReservationsForParking = getAllReservationsForParking;
// Obtenir les réservations d'un utilisateur (CLIENT)
const getUserReservations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Non autorisé' });
        const reservations = yield prisma.reservation.findMany({
            where: { userId: req.user.id },
            include: { vehicle: true },
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
// Obtenir une réservation spécifique
const getReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Non autorisé' });
        const { id } = req.params;
        const reservation = yield prisma.reservation.findUnique({
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
            const parking = yield prisma.parking.findUnique({
                where: { userId: req.user.id },
            });
            if (!parking || reservation.vehicle.parkingId !== parking.id) {
                return res.status(403).json({ message: 'Accès non autorisé' });
            }
        }
        return res.json(reservation);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.getReservation = getReservation;
// Annuler une réservation
const cancelReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Non autorisé' });
        const { id } = req.params;
        const reservation = yield prisma.reservation.findUnique({
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
            const parking = yield prisma.parking.findUnique({
                where: { userId: req.user.id },
            });
            if (!parking || reservation.vehicle.parkingId !== parking.id) {
                return res.status(403).json({ message: 'Accès non autorisé' });
            }
        }
        // Ne vérifier les 24h que pour les locations
        if (reservation.type === client_1.ReservationType.LOCATION && reservation.dateDebut) {
            const now = new Date();
            const minCancelTime = new Date(reservation.dateDebut);
            minCancelTime.setDate(minCancelTime.getDate() - 1);
            if (now > minCancelTime) {
                return res.status(400).json({ message: 'Annulation impossible moins de 24h avant' });
            }
        }
        yield prisma.reservation.delete({
            where: { id: Number(id) },
        });
        // Restaurer le statut opérationnel
        yield prisma.vehicle.update({
            where: { id: reservation.vehicleId },
            data: { status: client_1.VehicleStatus.DISPONIBLE },
        });
        yield prisma.vehicleStats.update({
            where: { vehicleId: reservation.vehicleId },
            data: { reservations: { decrement: 1 } },
        });
        return res.json({ message: 'Réservation annulée avec succès' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.cancelReservation = cancelReservation;
// Mettre à jour une réservation (ADMIN)
const updateReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Accès non autorisé' });
        }
        const { id } = req.params;
        const data = reservationSchema.partial().parse(req.body);
        const existingReservation = yield prisma.reservation.findUnique({
            where: { id: Number(id) },
        });
        if (!existingReservation) {
            return res.status(404).json({ message: 'Réservation non trouvée' });
        }
        const updatedReservation = yield prisma.reservation.update({
            where: { id: Number(id) },
            data,
            include: { vehicle: true, user: true },
        });
        return res.json(updatedReservation);
    }
    catch (err) {
        console.error(err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.updateReservation = updateReservation;
