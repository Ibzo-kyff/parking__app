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
exports.deleteNotification = exports.markAsRead = exports.getNotificationById = exports.getNotifications = exports.createNotification = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
console.log('DEBUG NotificationType:', client_1.NotificationType);
const prisma = new client_1.PrismaClient();
// Schéma de validation
const createNotificationSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(100),
    message: zod_1.z.string().min(5).max(500),
    type: zod_1.z.nativeEnum(client_1.NotificationType),
    userId: zod_1.z.number().optional(),
    parkingId: zod_1.z.number().optional()
});
// CREATE NOTIFICATION
const createNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const validatedData = createNotificationSchema.parse(req.body);
        const { userId, parkingId } = validatedData;
        // Validation: doit avoir soit userId soit parkingId, mais pas les deux
        if ((userId && parkingId) || (!userId && !parkingId)) {
            return res.status(400).json({
                error: "La notification doit être associée soit à un utilisateur (userId), soit à un parking (parkingId)"
            });
        }
        const notification = yield prisma.notification.create({
            data: {
                title: validatedData.title,
                message: validatedData.message,
                type: validatedData.type,
                userId,
                parkingId
            },
            include: {
                user: { select: { id: true, email: true } },
                parking: { select: { id: true, name: true } }
            }
        });
        return res.status(201).json({
            success: true,
            data: notification
        });
    }
    catch (err) {
        console.error("Erreur création notification:", err);
        return res.status(500).json({
            error: "Erreur serveur",
            details: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
});
exports.createNotification = createNotification;
// GET ALL NOTIFICATIONS (avec filtres)
const getNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, parkingId, read, type } = req.query;
        const notifications = yield prisma.notification.findMany({
            where: Object.assign(Object.assign(Object.assign(Object.assign({}, (userId && { userId: Number(userId) })), (parkingId && { parkingId: Number(parkingId) })), (read !== undefined && { read: read === 'true' })), (type && { type: type })),
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, email: true } },
                parking: { select: { id: true, name: true } }
            }
        });
        return res.json({ success: true, data: notifications });
    }
    catch (err) {
        console.error("Erreur récupération notifications:", err);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});
exports.getNotifications = getNotifications;
// GET NOTIFICATION BY ID
const getNotificationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const notification = yield prisma.notification.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                user: { select: { id: true, email: true } },
                parking: { select: { id: true, name: true } }
            }
        });
        if (!notification) {
            return res.status(404).json({ error: "Notification non trouvée" });
        }
        return res.json({ success: true, data: notification });
    }
    catch (err) {
        console.error("Erreur récupération notification:", err);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});
exports.getNotificationById = getNotificationById;
// MARK AS READ
const markAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const notification = yield prisma.notification.update({
            where: { id: Number(req.params.id) },
            data: { read: true }
        });
        return res.json({
            success: true,
            message: "Notification marquée comme lue",
            data: notification
        });
    }
    catch (err) {
        console.error("Erreur mise à jour notification:", err);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});
exports.markAsRead = markAsRead;
// DELETE NOTIFICATION
const deleteNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma.notification.delete({
            where: { id: Number(req.params.id) }
        });
        return res.json({
            success: true,
            message: "Notification supprimée avec succès"
        });
    }
    catch (err) {
        console.error("Erreur suppression notification:", err);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});
exports.deleteNotification = deleteNotification;
