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
exports.deleteParking = exports.updateParking = exports.getParkingById = exports.getAllParkings = exports.createParking = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// CREATE PARKING
const createParking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, name, address, phone, email, city, description, capacity, hoursOfOperation, status, } = req.body;
    try {
        // Vérifie que l'utilisateur existe et a le rôle PARKING
        const user = yield prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== client_1.Role.PARKING) {
            return res.status(400).json({ error: "Utilisateur invalide ou non autorisé à gérer un parking." });
        }
        if (!city) {
            return res.status(400).json({ error: "Le champ 'city' est requis" });
        }
        // Vérifie qu'un parking n'existe pas déjà pour cet utilisateur
        const existingParking = yield prisma.parking.findUnique({ where: { userId } });
        if (existingParking) {
            return res.status(400).json({ error: "Un parking est déjà associé à cet utilisateur." });
        }
        const newParking = yield prisma.parking.create({
            data: {
                userId,
                name,
                address,
                phone,
                city,
                email,
                description,
                capacity,
                hoursOfOperation,
                status: status || client_1.ParkingStatus.ACTIVE,
                logo: req.body.logo || undefined
            }
        });
        return res.status(201).json({ message: 'Parking créé avec succès', parking: newParking });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erreur lors de la création du parking', details: err.message || err });
    }
});
exports.createParking = createParking;
// GET ALL PARKINGS
const getAllParkings = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const parkings = yield prisma.parking.findMany({
            include: { user: true, vehicles: true }
        });
        return res.json(parkings);
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des parkings' });
    }
});
exports.getAllParkings = getAllParkings;
// GET PARKING BY ID
const getParkingById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const parking = yield prisma.parking.findUnique({
            where: { id: parseInt(id) },
            include: { user: true, vehicles: true }
        });
        if (!parking) {
            return res.status(404).json({ error: 'Parking non trouvé' });
        }
        return res.json(parking);
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération du parking' });
    }
});
exports.getParkingById = getParkingById;
// UPDATE PARKING
const updateParking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, address, phone, city, email, description, capacity, hoursOfOperation, status } = req.body;
    try {
        const updatedParking = yield prisma.parking.update({
            where: { id: parseInt(id) },
            data: Object.assign({ name,
                address,
                phone,
                city,
                email,
                description,
                capacity,
                hoursOfOperation,
                status }, (req.body.logo && { logo: req.body.logo }))
        });
        return res.json({ message: 'Parking mis à jour', parking: updatedParking });
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la mise à jour du parking' });
    }
});
exports.updateParking = updateParking;
// DELETE PARKING
const deleteParking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma.parking.delete({ where: { id: parseInt(id) } });
        return res.json({ message: 'Parking supprimé avec succès' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la suppression du parking' });
    }
});
exports.deleteParking = deleteParking;
