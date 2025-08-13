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
exports.getRecentParkings = exports.getDistinctModels = exports.getDistinctMarques = exports.deleteVehicule = exports.updateVehicule = exports.getVehiculeById = exports.getAllVehicules = exports.createVehicule = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// CREATE VEHICULE
const createVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userOwnerId, parkingId, marque, model, prix, description, photos = [], garantie = false, dureeGarantie, documents = [], chauffeur = false, // Valeur par défaut true
    assurance, dureeAssurance, carteGrise, vignette, fuelType, mileage } = req.body;
    // 🚫 Un seul des deux doit être fourni
    if ((userOwnerId && parkingId) || (!userOwnerId && !parkingId)) {
        return res.status(400).json({
            error: 'Un véhicule doit appartenir soit à un utilisateur (userOwnerId), soit à un parking (parkingId), mais pas aux deux ou aucun.'
        });
    }
    try {
        // Vérification de l'existence du client
        if (userOwnerId) {
            const user = yield prisma.user.findUnique({ where: { id: userOwnerId } });
            if (!user || user.role !== client_1.Role.CLIENT) {
                return res.status(400).json({ error: 'Utilisateur invalide ou non client.' });
            }
        }
        // Vérification du parking
        if (parkingId) {
            const parking = yield prisma.parking.findUnique({ where: { id: parkingId } });
            if (!parking) {
                return res.status(400).json({ error: 'Parking non trouvé.' });
            }
        }
        // Construction dynamique de l'objet data
        const vehiculeData = {
            marque,
            model,
            prix: Number(prix),
            description,
            photos,
            garantie,
            dureeGarantie: dureeGarantie ? Number(dureeGarantie) : null,
            documents,
            chauffeur, // Utilise la valeur fournie ou true par défaut
            assurance,
            dureeAssurance: dureeAssurance ? Number(dureeAssurance) : null,
            carteGrise,
            vignette,
            fuelType,
            mileage: mileage ? Number(mileage) : null,
        };
        if (userOwnerId)
            vehiculeData.userOwnerId = userOwnerId;
        if (parkingId)
            vehiculeData.parkingId = parkingId;
        // Création du véhicule
        const vehicule = yield prisma.vehicle.create({
            data: vehiculeData
        });
        return res.status(201).json({ message: 'Véhicule enregistré avec succès', vehicule });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({
            error: 'Erreur lors de la création du véhicule',
            details: (err === null || err === void 0 ? void 0 : err.message) || err
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
