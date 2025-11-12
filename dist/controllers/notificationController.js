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
exports.deleteNotification = exports.markAsRead = exports.getNotifications = exports.createNotification = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const expo_server_sdk_1 = require("expo-server-sdk");
const prisma = new client_1.PrismaClient();
const expo = new expo_server_sdk_1.Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
// === SCHEMA DE VALIDATION ===
const createNotificationSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(100),
    message: zod_1.z.string().min(5).max(500),
    type: zod_1.z.nativeEnum(client_1.NotificationType),
    userId: zod_1.z.number().optional(),
    parkingId: zod_1.z.number().optional(),
});
// === ENVOI PUSH EXPO ===
const sendPushNotification = (token, title, body, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!expo_server_sdk_1.Expo.isExpoPushToken(token)) {
        console.warn("Token Expo invalide:", token);
        return;
    }
    try {
        const receipts = yield expo.sendPushNotificationsAsync([
            {
                to: token,
                sound: "default",
                title,
                body: body.length > 150 ? body.substring(0, 150) + "..." : body,
                data,
                priority: "high",
            },
        ]);
        console.log("Push envoyé :", receipts[0]);
    }
    catch (error) {
        console.error("Erreur envoi push :", error.message);
    }
});
// === CRÉER UNE NOTIFICATION ===
const createNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const data = createNotificationSchema.parse(req.body);
        const { userId, parkingId, title, message, type } = data;
        // Validation : un seul des deux doit être défini
        if ((userId && parkingId) || (!userId && !parkingId)) {
            return res.status(400).json({
                error: "Doit avoir soit userId, soit parkingId (pas les deux)",
            });
        }
        // Vérification existence
        if (userId) {
            const user = yield prisma.user.findUnique({ where: { id: userId } });
            if (!user)
                return res.status(404).json({ error: "Utilisateur non trouvé" });
        }
        else if (parkingId) {
            const parking = yield prisma.parking.findUnique({ where: { id: parkingId } });
            if (!parking)
                return res.status(404).json({ error: "Parking non trouvé" });
        }
        // Création
        const notification = yield prisma.notification.create({
            data: { title, message, type, userId, parkingId },
            include: {
                user: { select: { expoPushToken: true } },
                parking: { select: { user: { select: { expoPushToken: true } } } },
            },
        });
        // Envoi push
        const token = ((_a = notification.user) === null || _a === void 0 ? void 0 : _a.expoPushToken) ||
            ((_c = (_b = notification.parking) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.expoPushToken);
        if (token) {
            yield sendPushNotification(token, title, message, {
                notificationId: notification.id,
                type,
            });
        }
        return res.status(201).json({ success: true, data: notification });
    }
    catch (err) {
        console.error("Erreur création notification:", err);
        return res.status(500).json({
            error: "Erreur serveur",
            details: err.message,
        });
    }
});
exports.createNotification = createNotification;
// === GET NOTIFICATIONS (Uniquement celles de l'utilisateur connecté) ===
const getNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const notifications = yield prisma.notification.findMany({
            where: {
                OR: [
                    { userId }, // notifications directes à l'utilisateur
                    { parking: { userId } }, // notifications liées à son parking
                ],
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                title: true,
                message: true,
                type: true,
                read: true,
                createdAt: true,
                parkingId: true,
            },
        });
        return res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications,
        });
    }
    catch (err) {
        console.error("Erreur récupération notifications:", err);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});
exports.getNotifications = getNotifications;
// === MARQUER COMME LUE ===
const markAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const notificationId = Number(req.params.id);
        const notif = yield prisma.notification.findFirst({
            where: {
                id: notificationId,
                OR: [{ userId }, { parking: { userId } }],
            },
        });
        if (!notif)
            return res
                .status(404)
                .json({ error: "Notification non trouvée ou non autorisée" });
        const updated = yield prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });
        return res.json({ success: true, message: "Marquée comme lue", data: updated });
    }
    catch (err) {
        console.error("Erreur markAsRead:", err);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});
exports.markAsRead = markAsRead;
// === SUPPRIMER UNE NOTIFICATION ===
const deleteNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const notificationId = Number(req.params.id);
        const notif = yield prisma.notification.findFirst({
            where: {
                id: notificationId,
                OR: [{ userId }, { parking: { userId } }],
            },
        });
        if (!notif)
            return res
                .status(404)
                .json({ error: "Notification non trouvée ou non autorisée" });
        yield prisma.notification.delete({ where: { id: notificationId } });
        return res.json({ success: true, message: "Supprimée avec succès" });
    }
    catch (err) {
        console.error("Erreur deleteNotification:", err);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});
exports.deleteNotification = deleteNotification;
