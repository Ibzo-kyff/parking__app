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
exports.updateReservation = exports.cancelReservation = exports.getReservation = exports.getUserReservations = exports.getAllReservations = exports.createReservation = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
// Schéma de validation
const reservationSchema = zod_1.z.object({
    vehicleId: zod_1.z.number(),
    dateDebut: zod_1.z.string().datetime(),
    dateFin: zod_1.z.string().datetime(),
    type: zod_1.z.nativeEnum(client_1.ReservationType),
});
// Créer une réservation
const createReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Non autorisé' });
        const data = reservationSchema.parse(req.body);
        const { vehicleId, dateDebut, dateFin, type } = data;
        const userId = req.user.id;
        // Convertir les dates
        const startDate = new Date(dateDebut);
        const endDate = new Date(dateFin);
        // Validation des dates
        if (startDate >= endDate) {
            return res.status(400).json({ message: 'La date de fin doit être après la date de début' });
        }
        // Vérifier la disponibilité du véhicule
        const vehicle = yield prisma.vehicle.findUnique({
            where: { id: vehicleId },
            include: { reservations: true },
        });
        if (!vehicle) {
            return res.status(404).json({ message: 'Véhicule non trouvé' });
        }
        if (vehicle.status !== client_1.VehicleStatus.DISPONIBLE) {
            return res.status(400).json({ message: 'Ce véhicule n\'est pas disponible' });
        }
        // Vérifier les conflits de réservation
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
        // Calcul de la commission (10% pour la location)
        const commission = type === client_1.ReservationType.LOCATION ? vehicle.prix * 0.1 : null;
        // Création de la réservation
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
        // Mettre à jour le statut du véhicule
        yield prisma.vehicle.update({
            where: { id: vehicleId },
            data: {
                status: type === client_1.ReservationType.ACHAT ? client_1.VehicleStatus.ACHETE : client_1.VehicleStatus.EN_LOCATION,
            },
        });
        // Mettre à jour les statistiques du véhicule
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
// Obtenir toutes les réservations (pour admin)
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
// Obtenir les réservations d'un utilisateur
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
        // Vérifier que l'utilisateur est autorisé à voir cette réservation
        if (req.user.role !== 'ADMIN' && reservation.userId !== req.user.id) {
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
        // Vérifier les permissions
        if (req.user.role !== 'ADMIN' && reservation.userId !== req.user.id) {
            return res.status(403).json({ message: 'Accès non autorisé' });
        }
        // Vérifier si l'annulation est possible (au moins 24h avant)
        const now = new Date();
        const minCancelTime = new Date(reservation.dateDebut);
        minCancelTime.setDate(minCancelTime.getDate() - 1); // 24h avant
        if (now > minCancelTime) {
            return res.status(400).json({ message: 'Annulation impossible moins de 24h avant' });
        }
        // Supprimer la réservation
        yield prisma.reservation.delete({
            where: { id: Number(id) },
        });
        // Remettre le véhicule à disponible si c'était une location
        if (reservation.type === client_1.ReservationType.LOCATION) {
            yield prisma.vehicle.update({
                where: { id: reservation.vehicleId },
                data: { status: client_1.VehicleStatus.DISPONIBLE },
            });
        }
        // Mettre à jour les statistiques
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
// Mettre à jour une réservation (pour admin)
const updateReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Accès non autorisé' });
        }
        const { id } = req.params;
        const data = reservationSchema.partial().parse(req.body);
        // Vérifier si la réservation existe
        const existingReservation = yield prisma.reservation.findUnique({
            where: { id: Number(id) },
        });
        if (!existingReservation) {
            return res.status(404).json({ message: 'Réservation non trouvée' });
        }
        // Mettre à jour la réservation
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
