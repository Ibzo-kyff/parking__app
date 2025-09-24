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
exports.deleteMarque = exports.updateMarque = exports.getMarqueById = exports.getAllMarques = exports.createMarque = void 0;
const client_1 = require("@prisma/client");
const blob_1 = require("@vercel/blob");
const prisma = new client_1.PrismaClient();
// CREATE MARQUE
const createMarque = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { name, isCustom } = req.body;
        // Validation des champs obligatoires
        if (!name) {
            return res.status(400).json({ error: 'Le champ name est obligatoire.' });
        }
        // Valider le format du booléen isCustom
        const parsedIsCustom = isCustom === 'true' ? true : false;
        // Uploader le logo vers Vercel Blob si fourni
        let logoUrl = undefined;
        const file = req.file;
        if (file) {
            const newFilename = `marques/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? (_a = file.originalname.match(/\.[0-9a-z]+$/i)) === null || _a === void 0 ? void 0 : _a[0] : '.jpg'}`;
            const result = yield (0, blob_1.put)(newFilename, file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            logoUrl = result.url;
        }
        const marque = yield prisma.marque.create({
            data: {
                name,
                logoUrl,
                isCustom: parsedIsCustom,
            },
        });
        return res.status(201).json({ message: 'Marque créée avec succès', marque });
    }
    catch (err) {
        console.error("Erreur lors de la création de la marque :", err);
        return res.status(500).json({
            error: "Erreur lors de la création de la marque",
            details: err instanceof Error ? err.message : "Erreur inconnue"
        });
    }
});
exports.createMarque = createMarque;
// GET ALL MARQUES WITH FILTERS
const getAllMarques = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, isCustom } = req.query;
    try {
        const where = {};
        if (name) {
            where.name = { contains: name, mode: 'insensitive' };
        }
        if (isCustom !== undefined) {
            where.isCustom = isCustom === 'true';
        }
        const marques = yield prisma.marque.findMany({
            where,
            include: {
                vehicles: true, // Optionnel : inclure les véhicules associés
            },
            orderBy: { name: 'asc' },
        });
        return res.json(marques);
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des marques' });
    }
});
exports.getAllMarques = getAllMarques;
// GET MARQUE BY ID
const getMarqueById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const marque = yield prisma.marque.findUnique({
            where: { id: parseInt(id) },
            include: {
                vehicles: true, // Optionnel : inclure les véhicules associés
            },
        });
        if (!marque) {
            return res.status(404).json({ error: 'Marque non trouvée' });
        }
        return res.json(marque);
    }
    catch (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération de la marque' });
    }
});
exports.getMarqueById = getMarqueById;
// UPDATE MARQUE
const updateMarque = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { name, isCustom } = req.body;
    try {
        // Vérifier si la marque existe
        const marque = yield prisma.marque.findUnique({ where: { id: parseInt(id) } });
        if (!marque) {
            return res.status(404).json({ error: 'Marque non trouvée' });
        }
        // Gérer le booléen isCustom si fourni
        const parsedIsCustom = isCustom !== undefined ? isCustom === 'true' : undefined;
        // Gérer le nouveau logo si fourni
        let logoUrl = marque.logoUrl; // Garder l'existant par défaut
        const file = req.file;
        if (file) {
            // Supprimer l'ancien blob si existant
            if (logoUrl) {
                try {
                    const url = new URL(logoUrl);
                    yield (0, blob_1.del)(url.pathname.slice(1));
                }
                catch (error) {
                    console.warn(`Ancien logo non supprimé, URL invalide : ${logoUrl}`);
                }
            }
            // Uploader le nouveau logo
            const newFilename = `marques/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? (_a = file.originalname.match(/\.[0-9a-z]+$/i)) === null || _a === void 0 ? void 0 : _a[0] : '.jpg'}`;
            const result = yield (0, blob_1.put)(newFilename, file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            logoUrl = result.url;
        }
        const updatedMarque = yield prisma.marque.update({
            where: { id: parseInt(id) },
            data: {
                name,
                logoUrl,
                isCustom: parsedIsCustom,
            },
        });
        return res.json({ message: 'Marque mise à jour', marque: updatedMarque });
    }
    catch (err) {
        console.error('Erreur lors de la mise à jour de la marque :', err);
        return res.status(500).json({
            error: 'Erreur lors de la mise à jour de la marque',
            details: err instanceof Error ? err.message : 'Erreur inconnue',
        });
    }
});
exports.updateMarque = updateMarque;
// DELETE MARQUE
const deleteMarque = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const marqueId = parseInt(id, 10);
    if (isNaN(marqueId)) {
        return res.status(400).json({ error: 'ID invalide' });
    }
    try {
        // Vérifier si la marque existe et récupérer le logo
        const marque = yield prisma.marque.findUnique({ where: { id: marqueId }, select: { logoUrl: true } });
        if (!marque) {
            return res.status(404).json({ error: 'Marque introuvable' });
        }
        // Supprimer le blob associé au logo si existant
        if (marque.logoUrl) {
            try {
                const url = new URL(marque.logoUrl);
                yield (0, blob_1.del)(url.pathname.slice(1));
            }
            catch (error) {
                console.warn(`Ancien logo non supprimé, URL invalide : ${marque.logoUrl}`);
            }
        }
        // Vérifier s'il y a des véhicules associés (optionnel : empêcher suppression si liés)
        const vehiclesCount = yield prisma.vehicle.count({ where: { marqueId } });
        if (vehiclesCount > 0) {
            return res.status(400).json({ error: 'Impossible de supprimer : marque liée à des véhicules' });
        }
        // Supprimer la marque
        yield prisma.marque.delete({
            where: { id: marqueId },
        });
        return res.json({ message: 'Marque supprimée avec succès' });
    }
    catch (err) {
        console.error('Erreur suppression marque:', err);
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Marque introuvable' });
        }
        return res.status(500).json({
            error: 'Erreur lors de la suppression de la marque',
            details: err.message || 'Erreur inconnue',
        });
    }
});
exports.deleteMarque = deleteMarque;
