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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteParking = exports.updateParking = exports.getParkingById = exports.getAllParkings = exports.createParking = void 0;
const client_1 = require("@prisma/client");
const blob_1 = require("@vercel/blob");
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
// CREATE PARKING
const createParking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, name, address, phone, email, city, description, capacity, hoursOfOperation, status, } = req.body;
    try {
        const user = yield prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!user || user.role !== client_1.Role.PARKING) {
            return res.status(400).json({ error: "Utilisateur invalide ou non autorisé à gérer un parking." });
        }
        if (!city) {
            return res.status(400).json({ error: "Le champ 'city' est requis" });
        }
        const existingParking = yield prisma.parking.findUnique({ where: { userId: Number(userId) } });
        if (existingParking) {
            return res.status(400).json({ error: "Un parking est déjà associé à cet utilisateur." });
        }
        let logoUrl = undefined;
        if (req.file) {
            try {
                // Upload vers Vercel Blob
                const blob = yield (0, blob_1.put)(`parking-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`, req.file.buffer, {
                    access: 'public',
                });
                logoUrl = blob.url;
            }
            catch (uploadError) {
                console.error('Erreur upload Vercel Blob:', uploadError);
                return res.status(500).json({ error: 'Erreur lors du téléchargement de l\'image' });
            }
        }
        const newParking = yield prisma.parking.create({
            data: {
                userId: Number(userId),
                name,
                address,
                phone,
                city,
                email,
                description,
                capacity: capacity ? Number(capacity) : 0,
                hoursOfOperation,
                status: status || client_1.ParkingStatus.ACTIVE,
                logo: logoUrl
            }
        });
        return res.status(201).json({ message: 'Parking créé avec succès', parking: newParking });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erreur lors de la création du parking', details: err.message });
    }
});
exports.createParking = createParking;
// GET ALL PARKINGS (inchangé)
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
// GET PARKING BY ID (inchangé)
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
        // Vérifier si parking existe
        const parking = yield prisma.parking.findUnique({ where: { id: Number(id) } });
        if (!parking) {
            return res.status(404).json({ error: 'Parking non trouvé' });
        }
        let newLogo = parking.logo;
        if (req.file) {
            // Supprimer l'ancien logo si existant et si c'est une URL valide
            if (parking.logo) {
                try {
                    const url = new URL(parking.logo);
                    yield (0, blob_1.del)(url.pathname.slice(1)); // Supprime le blob si c'est une URL valide
                }
                catch (error) {
                    // Si parking.logo n'est pas une URL valide, on ignore l'erreur (ancien chemin local par ex.)
                    console.warn(`Ancien logo non supprimé, URL invalide : ${parking.logo}`);
                }
            }
            // Upload nouveau logo vers Vercel Blob
            const newFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${req.file.originalname ? path_1.default.extname(req.file.originalname) : '.png'}`;
            const result = yield (0, blob_1.put)(newFilename, req.file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            newLogo = result.url;
        }
        const updatedParking = yield prisma.parking.update({
            where: { id: Number(id) },
            data: {
                name,
                address,
                phone,
                city,
                email,
                description,
                capacity: capacity ? Number(capacity) : 0,
                hoursOfOperation,
                status,
                logo: newLogo
            }
        });
        return res.json({ message: 'Parking mis à jour', parking: updatedParking });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour du parking', details: err.message || err });
    }
});
exports.updateParking = updateParking;
// DELETE PARKING (optionnel : ajoutez suppression du logo si besoin)
const deleteParking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const parking = yield prisma.parking.findUnique({ where: { id: parseInt(id) } });
        if (parking && parking.logo) {
            // Supprimer le logo du blob
            const url = new URL(parking.logo);
            yield (0, blob_1.del)(url.pathname.slice(1));
        }
        yield prisma.parking.delete({ where: { id: parseInt(id) } });
        return res.json({ message: 'Parking supprimé avec succès' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la suppression du parking' });
    }
});
exports.deleteParking = deleteParking;
