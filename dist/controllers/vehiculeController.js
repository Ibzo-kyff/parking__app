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
exports.getParkingStats = exports.getParkingUserVehicles = exports.getRecentParkings = exports.getDistinctModels = exports.getDistinctMarques = exports.deleteVehicule = exports.updateVehicule = exports.getVehiculeById = exports.getAllVehicules = exports.createVehicule = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// CREATE VEHICULE
const createVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userOwnerId, parkingId, marque, model, prix, description, garantie, dureeGarantie, chauffeur, assurance, dureeAssurance, carteGrise, vignette, fuelType, mileage } = req.body;
        // multer place les fichiers dans req.files
        const photos = req.files.map(f => `/uploads/${f.filename}`);
        if ((userOwnerId && parkingId) || (!userOwnerId && !parkingId)) {
            return res.status(400).json({
                error: "Un véhicule doit appartenir soit à un utilisateur (userOwnerId), soit à un parking (parkingId), mais pas aux deux ou aucun."
            });
        }
        const vehicule = yield prisma.vehicle.create({
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
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Erreur lors de la création du véhicule" });
    }
});
exports.createVehicule = createVehicule;
// GET ALL VEHICULES WITH FILTERS
const getAllVehicules = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { marque, model, minPrix, maxPrix, fuelType, maxMileage, withChauffeur, withGarantie, parkingId, userOwnerId, status } = req.query;
    try {
        const where = {};
        if (marque) {
            where.marque = { contains: marque, mode: 'insensitive' };
        }
        if (model) {
            where.model = { contains: model, mode: 'insensitive' };
        }
        if (minPrix || maxPrix) {
            where.prix = {};
            if (minPrix)
                where.prix.gte = Number(minPrix);
            if (maxPrix)
                where.prix.lte = Number(maxPrix);
        }
        if (fuelType) {
            where.fuelType = fuelType;
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
            where.status = status;
        }
        const vehicules = yield prisma.vehicle.findMany({
            where,
            include: {
                parking: true,
                userOwner: true,
                stats: true,
                favorites: true
            }
        });
        return res.json(vehicules);
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des véhicules' });
    }
});
exports.getAllVehicules = getAllVehicules;
// GET VEHICULE BY ID
const getVehiculeById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const vehicule = yield prisma.vehicle.findUnique({
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
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération du véhicule' });
    }
});
exports.getVehiculeById = getVehiculeById;
// UPDATE VEHICULE
const updateVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { marque, prix, description, photos, garantie, dureeGarantie, documents, chauffeur, assurance, dureeAssurance, carteGrise, vignette, status } = req.body;
    try {
        const updatedVehicule = yield prisma.vehicle.update({
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
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la mise à jour du véhicule' });
    }
});
exports.updateVehicule = updateVehicule;
// DELETE VEHICULE
const deleteVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma.vehicle.delete({
            where: { id: parseInt(id) }
        });
        return res.json({ message: 'Véhicule supprimé avec succès' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la suppression du véhicule' });
    }
});
exports.deleteVehicule = deleteVehicule;
// GET DISTINCT MARQUES
const getDistinctMarques = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const marques = yield prisma.vehicle.findMany({
            select: { marque: true },
            distinct: ['marque']
        });
        return res.json(marques.map((v) => v.marque));
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des marques' });
    }
});
exports.getDistinctMarques = getDistinctMarques;
// GET DISTINCT MODELS
const getDistinctModels = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const models = yield prisma.vehicle.findMany({
            select: { model: true },
            distinct: ['model']
        });
        return res.json(models.map((v) => v.model));
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des modèles' });
    }
});
exports.getDistinctModels = getDistinctModels;
// GET RECENT PARKINGS IMAGES (LAST 4 ADDED PARKINGS WITH THEIR PHOTOS/LOGOS)
const getRecentParkings = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const parkings = yield prisma.parking.findMany({
            orderBy: { createdAt: 'desc' }, // Assumes parking has a createdAt field
            take: 4,
            select: {
                id: true,
                logo: true // Assumes parking has a 'photos' field similar to vehicles; adjust if it's 'logo' or another field
            }
        });
        return res.json(parkings);
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des parkings récents' });
    }
});
exports.getRecentParkings = getRecentParkings;
// GET VEHICLES FOR PARKING USER WITH STATS
const getParkingUserVehicles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Vérifier que l'utilisateur est authentifié et a le rôle PARKING
        if (!req.user || req.user.role !== client_1.Role.PARKING) {
            return res.status(403).json({
                error: 'Accès refusé. Seuls les utilisateurs PARKING peuvent accéder à cette ressource.'
            });
        }
        // Récupérer l'ID de l'utilisateur connecté
        const userId = req.user.id;
        // Trouver le parking associé à cet utilisateur
        const parking = yield prisma.parking.findFirst({
            where: { userId: userId },
            select: { id: true, name: true }
        });
        if (!parking) {
            return res.status(404).json({
                error: 'Aucun parking trouvé pour cet utilisateur.'
            });
        }
        // Récupérer les véhicules du parking avec les relations nécessaires
        const vehicles = yield prisma.vehicle.findMany({
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
            totalVues: vehicles.reduce((sum, vehicle) => { var _a; return sum + (((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.vues) || 0); }, 0),
            totalReservations: vehicles.reduce((sum, vehicle) => { var _a; return sum + (((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.reservations) || 0); }, 0),
            totalFavoris: vehicles.reduce((sum, vehicle) => sum + vehicle.favorites.length, 0)
        };
        // Formater les véhicules avec des statistiques supplémentaires
        const formattedVehicles = vehicles.map(vehicle => {
            var _a, _b;
            return (Object.assign(Object.assign({}, vehicle), { stats: {
                    vues: ((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.vues) || 0,
                    reservations: ((_b = vehicle.stats) === null || _b === void 0 ? void 0 : _b.reservations) || 0,
                    favoris: vehicle.favorites.length,
                    reservationsActives: vehicle.reservations.filter(r => new Date(r.dateFin) > new Date()).length
                } }));
        });
        return res.json({
            parking: {
                id: parking.id,
                name: parking.name
            },
            statistics: stats,
            vehicles: formattedVehicles
        });
    }
    catch (err) {
        console.error('Erreur lors de la récupération des véhicules du parking:', err);
        return res.status(500).json({
            error: 'Erreur lors de la récupération des véhicules du parking',
            details: err instanceof Error ? err.message : 'Erreur inconnue'
        });
    }
});
exports.getParkingUserVehicles = getParkingUserVehicles;
// Optionnel : Ajouter une route pour les statistiques détaillées
const getParkingStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== client_1.Role.PARKING) {
            return res.status(403).json({
                error: 'Accès refusé'
            });
        }
        const userId = req.user.id;
        const parking = yield prisma.parking.findFirst({
            where: { userId: userId },
            select: { id: true }
        });
        if (!parking) {
            return res.status(404).json({ error: 'Parking non trouvé' });
        }
        // Statistiques mensuelles, etc.
        const monthlyStats = yield prisma.vehicle.groupBy({
            by: ['status'],
            where: { parkingId: parking.id },
            _count: { id: true }
        });
        return res.json({ monthlyStats });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.getParkingStats = getParkingStats;
