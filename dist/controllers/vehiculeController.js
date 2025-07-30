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
exports.deleteVehicule = exports.updateVehicule = exports.getVehiculeById = exports.getAllVehicules = exports.createVehicule = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// CREATE VEHICULE
const createVehicule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { parkingId, marque, prix, description, photos, garantie, dureeGarantie, documents, chauffeur } = req.body;
    try {
        const vehicule = yield prisma.vehicle.create({
            data: {
                parkingId,
                marque,
                prix,
                description,
                photos,
                garantie,
                dureeGarantie,
                documents,
                chauffeur
            }
        });
        return res.status(201).json({ message: 'Véhicule enregistré', vehicule });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erreur lors de la création du véhicule' });
    }
});
exports.createVehicule = createVehicule;
// GET ALL VEHICULES
const getAllVehicules = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vehicules = yield prisma.vehicle.findMany({
            include: {
                parking: true,
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
    const { marque, prix, description, photos, garantie, dureeGarantie, documents, chauffeur } = req.body;
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
                chauffeur
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
