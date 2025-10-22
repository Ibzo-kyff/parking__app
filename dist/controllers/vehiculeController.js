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
exports.addVehicleView = exports.getParkingManagementData = exports.getParkingUserVehicleById = exports.getParkingStats = exports.getParkingUserVehicles = exports.getRecentParkings = exports.getDistinctModels = exports.getDistinctMarques = exports.deleteVehicule = exports.getVehiculeById = exports.getAllVehicules = exports.updateVehicule = exports.createVehicule = void 0;
const client_1 = require("@prisma/client");
const blob_1 = require("@vercel/blob");
const prisma = new client_1.PrismaClient();
// Fonction utilitaire pour normaliser et gérer les marques
const findOrCreateMarque = (marqueName) => __awaiter(void 0, void 0, void 0, function* () {
    if (!marqueName || typeof marqueName !== 'string' || marqueName.trim() === '') {
        throw new Error('Le nom de la marque est invalide');
    }
    // Normalisation plus robuste
    const normalizedMarque = marqueName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul
        .normalize('NFD') // Normaliser les caractères accentués
        .replace(/[\u0300-\u036f]/g, ''); // Supprimer les diacritiques
    // Recherche avec différentes variantes pour éviter les doublons
    const existingMarque = yield prisma.marque.findFirst({
        where: {
            OR: [
                { name: normalizedMarque },
                { name: { equals: marqueName, mode: 'insensitive' } },
                { name: { equals: normalizedMarque, mode: 'insensitive' } }
            ]
        }
    });
    if (existingMarque) {
        return existingMarque;
    }
    // Création avec vérification de conflit
    try {
        const newMarque = yield prisma.marque.create({
            data: {
                name: normalizedMarque
            },
        });
        return newMarque;
    }
    catch (error) {
        // En cas de conflit (doublon détecté par la base de données), on refait une recherche
        if (error.code === 'P2002') {
            const marque = yield prisma.marque.findUnique({
                where: { name: normalizedMarque }
            });
            if (marque) {
                return marque;
            }
        }
        throw error;
    }
});
// CREATE VEHICULE
const createVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { userOwnerId, parkingId, marque, model, year, prix, description, garantie, dureeGarantie, chauffeur, assurance, dureeAssurance, carteGrise, vignette, fuelType, mileage, forSale, forRent, } = req.body;
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
        if (year && isNaN(parsedYear)) {
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
        // Gérer la marque avec la fonction utilitaire
        let marqueEntity;
        try {
            marqueEntity = yield findOrCreateMarque(marque);
        }
        catch (error) {
            return res.status(400).json({
                error: 'Erreur lors de la gestion de la marque',
                details: error.message
            });
        }
        // Uploader les photos vers Vercel Blob
        const files = req.files;
        const photos = [];
        if (files && files.length > 0) {
            for (const file of files) {
                const newFilename = `vehicles/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? (_a = file.originalname.match(/\.[0-9a-z]+$/i)) === null || _a === void 0 ? void 0 : _a[0] : '.jpg'}`;
                const result = yield (0, blob_1.put)(newFilename, file.buffer, {
                    access: 'public',
                    token: process.env.BLOB_READ_WRITE_TOKEN,
                });
                photos.push(result.url);
            }
        }
        const vehicule = yield prisma.vehicle.create({
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
    }
    catch (err) {
        console.error("Erreur lors de la création du véhicule :", err);
        return res.status(500).json({
            error: "Erreur lors de la création du véhicule",
            details: err instanceof Error ? err.message : "Erreur inconnue",
        });
    }
});
exports.createVehicule = createVehicule;
// UPDATE VEHICULE
const updateVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { marque, model, year, prix, description, garantie, dureeGarantie, chauffeur, assurance, dureeAssurance, carteGrise, vignette, fuelType, mileage, status, forSale, forRent, } = req.body;
    try {
        // Vérifier si le véhicule existe
        const vehicule = yield prisma.vehicle.findUnique({ where: { id: parseInt(id) } });
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
        // Gérer la marque si fournie avec la fonction utilitaire
        let marqueId = undefined;
        if (marque) {
            if (typeof marque !== 'string' || marque.trim() === '') {
                return res.status(400).json({ error: 'La marque doit être une chaîne de caractères non vide.' });
            }
            try {
                const marqueEntity = yield findOrCreateMarque(marque);
                marqueId = marqueEntity.id;
            }
            catch (error) {
                return res.status(400).json({
                    error: 'Erreur lors de la gestion de la marque',
                    details: error.message
                });
            }
        }
        // Gérer les booléens forSale et forRent si fournis
        const parsedForSale = forSale !== undefined ? forSale === 'true' : undefined;
        const parsedForRent = forRent !== undefined ? forRent === 'true' : undefined;
        // Gérer les nouvelles photos
        let photos = vehicule.photos; // Garder les photos existantes par défaut
        const files = req.files;
        if (files && files.length > 0) {
            // Supprimer les anciens blobs si existants
            if (photos && photos.length > 0) {
                for (const photo of photos) {
                    try {
                        const url = new URL(photo);
                        yield (0, blob_1.del)(url.pathname.slice(1));
                    }
                    catch (error) {
                        console.warn(`Ancien blob non supprimé, URL invalide : ${photo}`);
                    }
                }
            }
            // Uploader les nouvelles photos
            photos = [];
            for (const file of files) {
                const newFilename = `vehicles/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? (_a = file.originalname.match(/\.[0-9a-z]+$/i)) === null || _a === void 0 ? void 0 : _a[0] : '.jpg'}`;
                const result = yield (0, blob_1.put)(newFilename, file.buffer, {
                    access: 'public',
                    token: process.env.BLOB_READ_WRITE_TOKEN,
                });
                photos.push(result.url);
            }
        }
        const updatedVehicule = yield prisma.vehicle.update({
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
    }
    catch (err) {
        console.error('Erreur lors de la mise à jour du véhicule :', err);
        if (err.code === 'P2002') {
            return res.status(400).json({
                error: 'Un doublon a été détecté.',
                details: 'La marque existe déjà avec un nom similaire.',
            });
        }
        return res.status(500).json({
            error: 'Erreur lors de la mise à jour du véhicule',
            details: err instanceof Error ? err.message : 'Erreur inconnue',
        });
    }
});
exports.updateVehicule = updateVehicule;
// GET ALL VEHICULES WITH FILTERS
const getAllVehicules = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { marque, model, minPrix, maxPrix, fuelType, maxMileage, withChauffeur, withGarantie, parkingId, userOwnerId, status, forSale, forRent, } = req.query;
    try {
        const where = {};
        if (marque) {
            where.marqueRef = { name: { contains: marque, mode: 'insensitive' } };
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
        if (forSale !== undefined) {
            where.forSale = forSale === 'true';
        }
        if (forRent !== undefined) {
            where.forRent = forRent === 'true';
        }
        const vehicules = yield prisma.vehicle.findMany({
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
                favorites: true,
                marqueRef: true
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
// DELETE VEHICULE
const deleteVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const vehiculeId = parseInt(id, 10);
    if (isNaN(vehiculeId)) {
        return res.status(400).json({ error: 'ID invalide' });
    }
    try {
        // Vérifier si le véhicule existe et récupérer les photos
        const vehicule = yield prisma.vehicle.findUnique({ where: { id: vehiculeId }, select: { photos: true } });
        if (!vehicule) {
            return res.status(404).json({ error: 'Véhicule introuvable' });
        }
        // Supprimer les blobs associés aux photos
        if (vehicule.photos && vehicule.photos.length > 0) {
            for (const photo of vehicule.photos) {
                try {
                    const url = new URL(photo);
                    yield (0, blob_1.del)(url.pathname.slice(1));
                }
                catch (error) {
                    console.warn(`Ancien blob non supprimé, URL invalide : ${photo}`);
                }
            }
        }
        // Supprimer les dépendances
        yield prisma.reservation.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.vehicleHistory.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.favorite.deleteMany({ where: { vehicleId: vehiculeId } });
        yield prisma.vehicleStats.deleteMany({ where: { vehicleId: vehiculeId } });
        // Puis supprimer le véhicule
        yield prisma.vehicle.delete({
            where: { id: vehiculeId },
        });
        return res.json({ message: 'Véhicule supprimé avec succès' });
    }
    catch (err) {
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
            enLocation: vehicles.filter(v => v.reservations.some(r => r.type === 'LOCATION' && new Date(r.dateFin) > now)).length,
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
                    reservationsActives: vehicle.reservations.filter(r => (r.dateFin ? new Date(r.dateFin) > now : true)).length
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
                reservationsActives: vehicle.reservations.filter(r => (r.dateFin ? new Date(r.dateFin) > now : true)).length,
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
                        return dateDebut !== null && (dateFin
                            ? dateDebut <= now && dateFin >= now
                            : dateDebut <= now);
                    }).length
                },
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
