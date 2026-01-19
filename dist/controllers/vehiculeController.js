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
exports.addVehicleView = exports.getParkingManagementData = exports.getParkingUserVehicleById = exports.getParkingStats = exports.getParkingUserVehicles = exports.getRecentParkings = exports.getDistinctModels = exports.getDistinctMarques = exports.deleteVehicule = exports.getVehiculeById = exports.getAllVehiculesAdmin = exports.getAllVehicules = exports.updateVehicule = exports.createVehicule = void 0;
const client_1 = require("@prisma/client");
const blob_1 = require("@vercel/blob");
const prisma = new client_1.PrismaClient();
// Fonction utilitaire pour normaliser et gérer les marques
const findOrCreateMarque = (marqueName) => __awaiter(void 0, void 0, void 0, function* () {
    if (!marqueName || typeof marqueName !== 'string' || marqueName.trim() === '') {
        throw new Error('Le nom de la marque est invalide');
    }
    const normalizedMarque = marqueName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const existingMarque = yield prisma.marque.findFirst({
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
        return yield prisma.marque.create({
            data: { name: normalizedMarque },
        });
    }
    catch (error) {
        if (error.code === 'P2002') {
            const marque = yield prisma.marque.findUnique({
                where: { name: normalizedMarque },
            });
            if (marque)
                return marque;
        }
        throw error;
    }
});
// CREATE VEHICULE
const createVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { userOwnerId, parkingId, marque, model, year, prix, description, garantie, dureeGarantie, chauffeur, assurance, dureeAssurance, carteGrise, vignette, fuelType, mileage, forSale, forRent, transmission, } = req.body;
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
        if (isNaN(parsedPrix))
            return res.status(400).json({ error: 'Le prix doit être un nombre valide.' });
        const parsedYear = year ? Number(year) : null;
        if (year && isNaN(parsedYear))
            return res.status(400).json({ error: "L'année doit être un nombre valide." });
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
        const marqueEntity = yield findOrCreateMarque(marque);
        const files = req.files;
        const photos = [];
        if ((files === null || files === void 0 ? void 0 : files.length) > 0) {
            for (const file of files) {
                const newFilename = `vehicles/${Date.now()}-${Math.round(Math.random() * 1e9)}${((_a = file.originalname.match(/\.[0-9a-z]+$/i)) === null || _a === void 0 ? void 0 : _a[0]) || '.jpg'}`;
                const result = yield (0, blob_1.put)(newFilename, file.buffer, {
                    access: 'public',
                    token: process.env.BLOB_READ_WRITE_TOKEN,
                });
                photos.push(result.url);
            }
        }
        const vehicule = yield prisma.vehicle.create({
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
                transmission: parsedTransmission,
                photos,
                userOwnerId: userOwnerId ? Number(userOwnerId) : undefined,
                parkingId: parkingId ? Number(parkingId) : undefined,
            },
        });
        return res.status(201).json({ message: 'Véhicule enregistré avec succès', vehicule });
    }
    catch (err) {
        console.error('Erreur création véhicule:', err);
        return res.status(500).json({
            error: 'Erreur lors de la création du véhicule',
            details: err.message || 'Erreur inconnue',
        });
    }
});
exports.createVehicule = createVehicule;
// UPDATE VEHICULE
const updateVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const body = req.body;
    try {
        const vehicule = yield prisma.vehicle.findUnique({ where: { id: parseInt(id) } });
        if (!vehicule)
            return res.status(404).json({ error: 'Véhicule non trouvé' });
        let marqueId = vehicule.marqueId;
        if (body.marque) {
            const marqueEntity = yield findOrCreateMarque(body.marque);
            marqueId = marqueEntity.id;
        }
        let photos = vehicule.photos;
        const files = req.files;
        if ((files === null || files === void 0 ? void 0 : files.length) > 0) {
            if (photos.length > 0) {
                for (const photo of photos) {
                    try {
                        const url = new URL(photo);
                        yield (0, blob_1.del)(url.pathname.slice(1));
                    }
                    catch (_b) { }
                }
            }
            photos = [];
            for (const file of files) {
                const newFilename = `vehicles/${Date.now()}-${Math.round(Math.random() * 1e9)}${((_a = file.originalname.match(/\.[0-9a-z]+$/i)) === null || _a === void 0 ? void 0 : _a[0]) || '.jpg'}`;
                const result = yield (0, blob_1.put)(newFilename, file.buffer, { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN });
                photos.push(result.url);
            }
        }
        const updatedVehicule = yield prisma.vehicle.update({
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
                transmission: body.transmission ? body.transmission.toUpperCase() : undefined,
                photos,
            },
        });
        return res.json({ message: 'Véhicule mis à jour', vehicule: updatedVehicule });
    }
    catch (err) {
        console.error('Erreur mise à jour véhicule:', err);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour', details: err.message });
    }
});
exports.updateVehicule = updateVehicule;
// GET ALL VEHICULES (PUBLIC) - Véhicules disponibles à l'achat ou à la location
const getAllVehicules = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = req.query;
    try {
        const where = {
            OR: [
                { forSale: true },
                { forRent: true }
            ],
            NOT: {
                reservations: {
                    some: {
                        type: client_1.ReservationType.ACHAT,
                        status: { in: [client_1.ReservationStatus.PENDING, client_1.ReservationStatus.ACCEPTED] },
                    },
                },
            },
        };
        if (query.marque)
            where.marqueRef = { name: { contains: query.marque, mode: 'insensitive' } };
        if (query.model)
            where.model = { contains: query.model, mode: 'insensitive' };
        if (query.minPrix || query.maxPrix) {
            where.prix = {};
            if (query.minPrix)
                where.prix.gte = Number(query.minPrix);
            if (query.maxPrix)
                where.prix.lte = Number(query.maxPrix);
        }
        if (query.fuelType)
            where.fuelType = query.fuelType;
        if (query.maxMileage)
            where.mileage = { lte: Number(query.maxMileage) };
        if (query.withChauffeur !== undefined)
            where.chauffeur = query.withChauffeur === 'true';
        if (query.withGarantie !== undefined)
            where.garantie = query.withGarantie === 'true';
        if (query.parkingId)
            where.parkingId = Number(query.parkingId);
        if (query.userOwnerId)
            where.userOwnerId = Number(query.userOwnerId);
        if (query.status)
            where.status = query.status;
        if (query.forSale !== undefined)
            where.forSale = query.forSale === 'true';
        if (query.forRent !== undefined)
            where.forRent = query.forRent === 'true';
        if (query.transmission)
            where.transmission = query.transmission;
        const vehicules = yield prisma.vehicle.findMany({
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
    }
    catch (err) {
        console.error('Erreur getAllVehicules:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des véhicules' });
    }
});
exports.getAllVehicules = getAllVehicules;
// GET ALL VEHICULES FOR ADMIN - Tous les véhicules sans restriction
const getAllVehiculesAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user || req.user.role !== client_1.Role.ADMIN) {
        return res.status(403).json({ message: 'Accès refusé. Réservé aux administrateurs.' });
    }
    const query = req.query;
    try {
        const where = {};
        if (query.marque)
            where.marqueRef = { name: { contains: query.marque, mode: 'insensitive' } };
        if (query.model)
            where.model = { contains: query.model, mode: 'insensitive' };
        if (query.minPrix || query.maxPrix) {
            where.prix = {};
            if (query.minPrix)
                where.prix.gte = Number(query.minPrix);
            if (query.maxPrix)
                where.prix.lte = Number(query.maxPrix);
        }
        if (query.fuelType)
            where.fuelType = query.fuelType;
        if (query.maxMileage)
            where.mileage = { lte: Number(query.maxMileage) };
        if (query.withChauffeur !== undefined)
            where.chauffeur = query.withChauffeur === 'true';
        if (query.withGarantie !== undefined)
            where.garantie = query.withGarantie === 'true';
        if (query.parkingId)
            where.parkingId = Number(query.parkingId);
        if (query.userOwnerId)
            where.userOwnerId = Number(query.userOwnerId);
        if (query.status)
            where.status = query.status;
        if (query.forSale !== undefined)
            where.forSale = query.forSale === 'true';
        if (query.forRent !== undefined)
            where.forRent = query.forRent === 'true';
        if (query.transmission)
            where.transmission = query.transmission;
        const vehicules = yield prisma.vehicle.findMany({
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
    }
    catch (err) {
        console.error('Erreur getAllVehiculesAdmin:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des véhicules (admin)' });
    }
});
exports.getAllVehiculesAdmin = getAllVehiculesAdmin;
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
                favorites: true,
                marqueRef: true,
            },
        });
        if (!vehicule)
            return res.status(404).json({ error: 'Véhicule non trouvé' });
        return res.json(vehicule);
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération du véhicule' });
    }
});
exports.getVehiculeById = getVehiculeById;
// DELETE VEHICULE
const deleteVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const vehiculeId = parseInt(id, 10);
    if (isNaN(vehiculeId))
        return res.status(400).json({ error: 'ID invalide' });
    try {
        const vehicule = yield prisma.vehicle.findUnique({ where: { id: vehiculeId }, select: { photos: true } });
        if (!vehicule)
            return res.status(404).json({ error: 'Véhicule introuvable' });
        if (vehicule.photos.length > 0) {
            for (const photo of vehicule.photos) {
                try {
                    const url = new URL(photo);
                    yield (0, blob_1.del)(url.pathname.slice(1));
                }
                catch (_a) { }
            }
        }
        yield prisma.reservation.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.vehicleHistory.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.favorite.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.vehicleStats.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.vehicle.delete({ where: { id: vehiculeId } });
        return res.json({ message: 'Véhicule supprimé avec succès' });
    }
    catch (err) {
        console.error('Erreur suppression:', err);
        return res.status(500).json({ error: 'Erreur lors de la suppression', details: err.message });
    }
});
exports.deleteVehicule = deleteVehicule;
// GET DISTINCT MARQUES
const getDistinctMarques = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const marques = yield prisma.marque.findMany({
            select: {
                id: true,
                name: true,
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
                logo: true
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
            enLocation: vehicles.filter(v => v.reservations.some(r => r.type === 'LOCATION' && r.status === 'ACCEPTED' && new Date(r.dateFin) > now)).length,
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
                    reservationsActives: vehicle.reservations.filter(r => r.status === 'ACCEPTED' && (r.dateFin ? new Date(r.dateFin) > now : true)).length
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
// GET PARKING STATS
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
        const formattedVehicle = Object.assign(Object.assign({}, vehicle), { stats: {
                vues: ((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.vues) || 0,
                reservations: ((_b = vehicle.stats) === null || _b === void 0 ? void 0 : _b.reservations) || 0,
                favoris: vehicle.favorites.length,
                reservationsActives: vehicle.reservations.filter(r => r.status === 'ACCEPTED' && (r.dateFin ? new Date(r.dateFin) > now : true)).length,
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
// GET PARKING MANAGEMENT DATA
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
                { marqueRef: { name: { contains: search, mode: 'insensitive' } } },
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
        const monthlyReservations = yield prisma.reservation.groupBy({
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
            totalVues: vehicles.reduce((sum, vehicle) => { var _a; return sum + (((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.vues) || 0); }, 0),
            totalReservations: vehicles.reduce((sum, vehicle) => { var _a; return sum + (((_a = vehicle.stats) === null || _a === void 0 ? void 0 : _a.reservations) || 0); }, 0),
            totalFavoris: vehicles.reduce((sum, vehicle) => sum + vehicle.favorites.length, 0),
            reservationsActives: activeReservations.length,
            monthlySales: monthlyReservations.filter(r => r.type === 'ACHAT').reduce((sum, r) => { var _a; return sum + (((_a = r._count) === null || _a === void 0 ? void 0 : _a.id) || 0); }, 0),
            monthlyRentals: monthlyReservations.filter(r => r.type === 'LOCATION').reduce((sum, r) => { var _a; return sum + (((_a = r._count) === null || _a === void 0 ? void 0 : _a.id) || 0); }, 0)
        };
        // Préparer les données pour les graphiques
        const monthlyData = prepareMonthlyChartData(monthlyReservations);
        // Formater les véhicules pour l'affichage
        const formattedVehicles = vehicles.map(vehicle => {
            var _a, _b, _c;
            return ({
                id: vehicle.id,
                marque: ((_a = vehicle.marqueRef) === null || _a === void 0 ? void 0 : _a.name) || '',
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
                    vues: ((_b = vehicle.stats) === null || _b === void 0 ? void 0 : _b.vues) || 0,
                    reservations: ((_c = vehicle.stats) === null || _c === void 0 ? void 0 : _c.reservations) || 0,
                    favoris: vehicle.favorites.length,
                    reservationsActives: vehicle.reservations.filter(r => {
                        const dateDebut = r.dateDebut ? new Date(r.dateDebut) : null;
                        const dateFin = r.dateFin ? new Date(r.dateFin) : null;
                        return r.status === 'ACCEPTED' && dateDebut !== null && (dateFin
                            ? dateDebut <= now && dateFin >= now
                            : dateDebut <= now);
                    }).length
                },
                nextReservation: vehicle.reservations.find(r => r.status === 'ACCEPTED') ? {
                    type: vehicle.reservations.find(r => r.status === 'ACCEPTED').type,
                    date: vehicle.reservations.find(r => r.status === 'ACCEPTED').dateDebut,
                    client: vehicle.reservations.find(r => r.status === 'ACCEPTED').user ?
                        `${vehicle.reservations.find(r => r.status === 'ACCEPTED').user.prenom} ${vehicle.reservations.find(r => r.status === 'ACCEPTED').user.nom}` : 'Inconnu'
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
        var _a, _b;
        const reservationDate = new Date(item.createdAt);
        const monthDiff = now.getMonth() - reservationDate.getMonth();
        if (monthDiff >= 0 && monthDiff < 6) {
            const index = 5 - monthDiff;
            if (item.type === 'ACHAT') {
                salesData[index] += (((_a = item._count) === null || _a === void 0 ? void 0 : _a.id) || 0);
            }
            else if (item.type === 'LOCATION') {
                rentalData[index] += (((_b = item._count) === null || _b === void 0 ? void 0 : _b.id) || 0);
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
const addVehicleView = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const vehicule = yield prisma.vehicle.findUnique({
            where: { id: parseInt(id) }
        });
        if (!vehicule) {
            return res.status(404).json({ error: 'Véhicule non trouvé' });
        }
        // Enregistrer la vue dans l'historique si utilisateur connecté (avec le schéma actuel)
        if (userId) {
            yield prisma.vehicleHistory.create({
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
        yield prisma.vehicleStats.upsert({
            where: { vehicleId: parseInt(id) },
            update: { vues: { increment: 1 } },
            create: {
                vehicleId: parseInt(id),
                vues: 1,
                reservations: 0
            }
        });
        return res.json({ message: 'Vue enregistrée avec succès' });
    }
    catch (err) {
        console.error('Erreur lors de l\'ajout de la vue:', err);
        return res.status(500).json({
            error: 'Erreur lors de l\'enregistrement de la vue'
        });
    }
});
exports.addVehicleView = addVehicleView;
