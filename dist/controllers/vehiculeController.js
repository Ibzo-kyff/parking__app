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
exports.getParkingManagementData = exports.getParkingUserVehicleById = exports.getParkingStats = exports.getParkingUserVehicles = exports.getRecentParkings = exports.getDistinctModels = exports.getDistinctMarques = exports.deleteVehicule = exports.updateVehicule = exports.getVehiculeById = exports.getAllVehicules = exports.createVehicule = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// CREATE VEHICULE
const createVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { userOwnerId, parkingId, marque, model, prix, description, garantie, dureeGarantie, chauffeur, assurance, dureeAssurance, carteGrise, vignette, fuelType, mileage, } = req.body;
        // Ajouter un log pour voir les données reçues
        console.log("Données reçues dans req.body :", req.body);
        // Validation des champs obligatoires
        if (!marque || !model || !prix) {
            return res.status(400).json({ error: "Les champs marque, modèle et prix sont obligatoires." });
        }
        if ((userOwnerId && parkingId) || (!userOwnerId && !parkingId)) {
            return res.status(400).json({
                error: "Un véhicule doit appartenir soit à un utilisateur (userOwnerId), soit à un parking (parkingId), mais pas aux deux ou aucun.",
            });
        }
        // Valider le format des champs booléens
        const parsedGarantie = garantie === "true" ? true : false;
        const parsedChauffeur = chauffeur === "true" ? true : false;
        const parsedAssurance = assurance === "true" ? true : false;
        const parsedCarteGrise = carteGrise === "true" ? true : false;
        const parsedVignette = vignette === "true" ? true : false;
        // Valider le format des champs numériques
        const parsedPrix = Number(prix);
        if (isNaN(parsedPrix)) {
            return res.status(400).json({ error: "Le prix doit être un nombre valide." });
        }
        const parsedDureeGarantie = dureeGarantie ? Number(dureeGarantie) : null;
        if (parsedGarantie && !parsedDureeGarantie) {
            return res.status(400).json({ error: "La durée de garantie est obligatoire si la garantie est activée." });
        }
        const parsedDureeAssurance = dureeAssurance ? Number(dureeAssurance) : null;
        if (parsedAssurance && !parsedDureeAssurance) {
            return res.status(400).json({ error: "La durée d'assurance est obligatoire si l'assurance est activée." });
        }
        const parsedMileage = mileage ? Number(mileage) : null;
        // multer place les fichiers dans req.files
        const photos = ((_a = req.files) === null || _a === void 0 ? void 0 : _a.map((f) => `/uploads/${f.filename}`)) || [];
        const vehicule = yield prisma.vehicle.create({
            data: {
                marque,
                model,
                prix: parsedPrix,
                description: description || "",
                fuelType,
                mileage: parsedMileage,
                garantie: parsedGarantie,
                dureeGarantie: parsedDureeGarantie,
                chauffeur: parsedChauffeur,
                assurance: parsedAssurance,
                dureeAssurance: parsedDureeAssurance,
                carteGrise: parsedCarteGrise,
                vignette: parsedVignette,
                photos,
                userOwnerId: userOwnerId ? Number(userOwnerId) : undefined,
                parkingId: parkingId ? Number(parkingId) : undefined,
            },
        });
        return res.status(201).json({ message: "Véhicule enregistré avec succès", vehicule });
    }
    catch (err) {
        console.error("Erreur lors de la création du véhicule :", err);
        return res.status(500).json({
            error: "Erreur lors de la création du véhicule",
            details: err instanceof Error ? err.message : "Erreur inconnue"
        });
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
    const vehiculeId = parseInt(id, 10);
    if (isNaN(vehiculeId)) {
        return res.status(400).json({ error: "ID invalide" });
    }
    try {
        // Supprimer d'abord les dépendances (si pas de cascade dans schema.prisma)
        yield prisma.reservation.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.vehicleHistory.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.favorite.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.vehicleStats.deleteMany({ where: { vehicleId: vehiculeId } });
        // Puis supprimer le véhicule
        yield prisma.vehicle.delete({
            where: { id: vehiculeId }
        });
        return res.json({ message: "Véhicule supprimé avec succès" });
    }
    catch (err) {
        console.error("Erreur suppression véhicule:", err);
        if (err.code === "P2025") {
            return res.status(404).json({ error: "Véhicule introuvable" });
        }
        if (err.code === "P2003") {
            return res.status(400).json({ error: "Impossible de supprimer : véhicule lié à d’autres données" });
        }
        return res.status(500).json({ error: "Erreur lors de la suppression du véhicule" });
    }
});
exports.deleteVehicule = deleteVehicule;
const getDistinctMarques = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const marques = yield prisma.vehicle.findMany({
            distinct: ['marque'],
            select: {
                id: true,
                marque: true,
            },
        });
        return res.json(marques);
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
// GET RECENT PARKINGS IMAGES
const getRecentParkings = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const parkings = yield prisma.parking.findMany({
            orderBy: { createdAt: 'desc' },
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
// GET SPECIFIC VEHICLE FOR PARKING USER WITH STATS
const getParkingUserVehicleById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        const vehicleId = parseInt(id);
        if (isNaN(vehicleId)) {
            return res.status(400).json({ error: 'ID de véhicule invalide' });
        }
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
        // Récupérer le véhicule spécifique du parking avec les relations nécessaires
        const vehicle = yield prisma.vehicle.findFirst({
            where: {
                id: vehicleId,
                parkingId: parking.id // Vérifier que le véhicule appartient bien au parking de l'utilisateur
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
                }
            }
        });
        if (!vehicle) {
            return res.status(404).json({
                error: 'Véhicule non trouvé ou vous n\'avez pas les droits pour accéder à ce véhicule.'
            });
        }
        // Formater les statistiques détaillées
        const formattedVehicle = Object.assign(Object.assign({}, vehicle), { stats: {
                vues: ((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.vues) || 0,
                reservations: ((_b = vehicle.stats) === null || _b === void 0 ? void 0 : _b.reservations) || 0,
                favoris: vehicle.favorites.length,
                reservationsActives: vehicle.reservations.filter(r => new Date(r.dateFin) > new Date()).length,
                reservationsTotal: vehicle.reservations.length
            } });
        return res.json({
            parking: {
                id: parking.id,
                name: parking.name
            },
            vehicle: formattedVehicle
        });
    }
    catch (err) {
        console.error('Erreur lors de la récupération du véhicule:', err);
        return res.status(500).json({
            error: 'Erreur lors de la récupération du véhicule',
            details: err instanceof Error ? err.message : 'Erreur inconnue'
        });
    }
});
exports.getParkingUserVehicleById = getParkingUserVehicleById;
// NOUVELLE MÉTHODE POUR LA PAGE DE GESTION DU PARKING
const getParkingManagementData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== client_1.Role.PARKING) {
            return res.status(403).json({
                error: 'Accès refusé. Seuls les utilisateurs PARKING peuvent accéder à cette ressource.'
            });
        }
        const { status, search } = req.query;
        const userId = req.user.id;
        // Trouver le parking associé à cet utilisateur
        const parking = yield prisma.parking.findFirst({
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
        const where = {
            parkingId: parking.id
        };
        // Filtrer par statut si spécifié
        if (status && status !== 'all') {
            where.status = status;
        }
        // Filtrer par recherche textuelle
        if (search) {
            where.OR = [
                { marque: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        // Récupérer les véhicules avec les relations nécessaires
        const vehicles = yield prisma.vehicle.findMany({
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
                            gte: new Date() // Réservations actives ou futures
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
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        // Récupérer toutes les réservations des 6 derniers mois pour les graphiques
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyReservations = yield prisma.reservation.groupBy({
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
            .filter(r => new Date(r.dateDebut) <= now && new Date(r.dateFin) >= now);
        const stats = {
            total: vehicles.length,
            vendus: vehicles.filter(v => v.status === 'ACHETE').length,
            enLocation: vehicles.filter(v => v.status === 'EN_LOCATION').length,
            disponibles: vehicles.filter(v => v.status === 'DISPONIBLE').length,
            enMaintenance: vehicles.filter(v => v.status === 'EN_MAINTENANCE').length,
            indisponibles: vehicles.filter(v => v.status === 'INDISPONIBLE').length,
            totalVues: vehicles.reduce((sum, vehicle) => { var _a; return sum + (((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.vues) || 0); }, 0),
            totalReservations: vehicles.reduce((sum, vehicle) => { var _a; return sum + (((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.reservations) || 0); }, 0),
            totalFavoris: vehicles.reduce((sum, vehicle) => sum + vehicle.favorites.length, 0),
            reservationsActives: activeReservations.length,
            // Statistiques pour les graphiques
            monthlySales: monthlyReservations.filter(r => r.type === 'ACHAT').reduce((sum, r) => sum + r._count.id, 0),
            monthlyRentals: monthlyReservations.filter(r => r.type === 'LOCATION').reduce((sum, r) => sum + r._count.id, 0)
        };
        // Préparer les données pour les graphiques
        const monthlyData = prepareMonthlyChartData(monthlyReservations);
        // Formater les véhicules pour l'affichage
        const formattedVehicles = vehicles.map(vehicle => {
            var _a, _b;
            return ({
                id: vehicle.id,
                marque: vehicle.marque,
                model: vehicle.model,
                prix: vehicle.prix,
                status: vehicle.status,
                photos: vehicle.photos,
                createdAt: vehicle.createdAt,
                stats: {
                    vues: ((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.vues) || 0,
                    reservations: ((_b = vehicle.stats) === null || _b === void 0 ? void 0 : _b.reservations) || 0,
                    favoris: vehicle.favorites.length,
                    reservationsActives: vehicle.reservations.filter(r => new Date(r.dateDebut) <= now && new Date(r.dateFin) >= now).length
                },
                // Prochaine réservation
                nextReservation: vehicle.reservations[0] ? {
                    type: vehicle.reservations[0].type,
                    date: vehicle.reservations[0].dateDebut,
                    client: vehicle.reservations[0].user ?
                        `${vehicle.reservations[0].user.prenom} ${vehicle.reservations[0].user.nom}` : 'Inconnu'
                } : null
            });
        });
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
                    labels: ['Vendus', 'En location', 'Disponibles', 'Maintenance', 'Indisponibles'],
                    data: [
                        stats.vendus,
                        stats.enLocation,
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
    }
    catch (err) {
        console.error('Erreur lors de la récupération des données de gestion du parking:', err);
        return res.status(500).json({
            error: 'Erreur lors de la récupération des données de gestion',
            details: err instanceof Error ? err.message : 'Erreur inconnue'
        });
    }
});
exports.getParkingManagementData = getParkingManagementData;
// Fonction helper pour préparer les données mensuelles des graphiques
function prepareMonthlyChartData(monthlyReservations) {
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
                salesData[index] += item._count.id;
            }
            else if (item.type === 'LOCATION') {
                rentalData[index] += item._count.id;
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
