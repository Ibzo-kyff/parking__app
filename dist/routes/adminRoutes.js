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
// src/routes/adminRouter.ts
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const prisma_1 = __importDefault(require("../utils/prisma"));
const router = express_1.default.Router();
// Middleware qui vérifie que l'utilisateur est ADMIN
const isAdmin = (req, res, next) => {
    var _a;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== 'ADMIN') {
        return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
    }
    next();
};
// ====================== ROUTE DES LOGS ======================
router.get('/logs', authMiddleware_1.authenticateToken, isAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 50, entity, action, search } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};
        if (entity)
            where.entity = entity;
        if (action)
            where.action = action;
        if (search) {
            where.OR = [
                { userName: { contains: search, mode: 'insensitive' } },
                { details: { contains: search, mode: 'insensitive' } },
            ];
        }
        const logs = yield prisma_1.default.auditLog.findMany({
            where,
            include: {
                user: {
                    select: { nom: true, prenom: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        });
        const total = yield prisma_1.default.auditLog.count({ where });
        res.json({
            success: true,
            logs,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération des logs' });
    }
}));
exports.default = router;
