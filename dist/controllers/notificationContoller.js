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
const expo_server_sdk_1 = require("expo-server-sdk");
const prisma = new client_1.PrismaClient();
const expo = new expo_server_sdk_1.Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
// === SCHÉMA ===
const createNotificationSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(100),
    message: zod_1.z.string().min(5).max(500),
    type: zod_1.z.nativeEnum(client_1.NotificationType),
    userId: zod_1.z.number().optional(),
    parkingId: zod_1.z.number().optional(),
});
// === ENVOI PUSH + NETTOYAGE TOKEN ===
const sendPushNotification = (token, title, body, data) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (!expo_server_sdk_1.Expo.isExpoPushToken(token)) {
        console.warn('Token invalide:', token);
        return null;
    }
    const message = {
        to: token,
        sound: 'default',
        title,
        body: body.substring(0, 150) + (body.length > 150 ? '...' : ''),
        data,
        priority: 'high',
    };
    try {
        const receipts = yield expo.sendPushNotificationsAsync([message]);
        const receipt = receipts[0];
        if (receipt.status === 'error') {
            if (((_a = receipt.details) === null || _a === void 0 ? void 0 : _a.error) === 'DeviceNotRegistered') {
                console.warn('Token périmé → suppression:', token);
                yield prisma.user.updateMany({
                    where: { expoPushToken: token },
                    data: { expoPushToken: null },
                });
            }
            else {
                console.error('Erreur push:', (_b = receipt.details) === null || _b === void 0 ? void 0 : _b.error);
            }
        }
        else {
            console.log('Push envoyé:', receipt.id);
        }
        return receipt;
    }
    catch (error) {
        console.error('Erreur envoi push:', error.message);
        return null;
    }
});
// === CRÉER NOTIFICATION ===
const createNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const data = createNotificationSchema.parse(req.body);
        const { userId, parkingId, title, message, type } = data;
        // Validation exclusive
        if ((userId && parkingId) || (!userId && !parkingId)) {
            return res.status(400).json({
                error: 'Doit avoir soit userId, soit parkingId (pas les deux)',
            });
        }
        // Vérifier existence
        if (userId) {
            const user = yield prisma.user.findUnique({ where: { id: userId } });
            if (!user)
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        if (parkingId) {
            const parking = yield prisma.parking.findUnique({ where: { id: parkingId } });
            if (!parking)
                return res.status(404).json({ error: 'Parking non trouvé' });
        }
        // Créer la notification
        const notification = yield prisma.notification.create({
            data: { title, message, type, userId, parkingId },
            include: {
                user: { select: { id: true, expoPushToken: true } },
                parking: { select: { id: true, user: { select: { expoPushToken: true } } } },
            },
        });
        // Récupérer le token
        let token = null;
        if (userId && ((_a = notification.user) === null || _a === void 0 ? void 0 : _a.expoPushToken)) {
            token = notification.user.expoPushToken;
        }
        else if (parkingId && ((_c = (_b = notification.parking) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.expoPushToken)) {
            token = notification.parking.user.expoPushToken;
        }
        // Envoyer le push
        if (token) {
            yield sendPushNotification(token, title, message, {
                notificationId: notification.id,
                type,
                screen: userId ? 'UserNotifications' : 'ParkingDetails',
            });
        }
        else {
            console.info('Aucun token Expo trouvé pour cette notification');
        }
        return res.status(201).json({ success: true, data: notification });
    }
    catch (err) {
        console.error('Erreur création notification:', err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: err.issues });
        }
        return res.status(500).json({
            error: 'Erreur serveur',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }
});
exports.createNotification = createNotification;
// === LES AUTRES FONCTIONS (get, mark, delete) RESTENT IDENTIQUES ===
const getNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, parkingId, read, type } = req.query;
        const notifications = yield prisma.notification.findMany({
            where: Object.assign(Object.assign(Object.assign(Object.assign({}, (userId && { userId: Number(userId) })), (parkingId && { parkingId: Number(parkingId) })), (read !== undefined && { read: read === 'true' })), (type && { type: type })),
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, email: true } },
                parking: { select: { id: true, name: true } },
            },
        });
        return res.json({ success: true, data: notifications });
    }
    catch (err) {
        console.error('Erreur get notifications:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.getNotifications = getNotifications;
const getNotificationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const notification = yield prisma.notification.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                user: { select: { id: true, email: true } },
                parking: { select: { id: true, name: true } },
            },
        });
        if (!notification) {
            return res.status(404).json({ error: 'Notification non trouvée' });
        }
        return res.json({ success: true, data: notification });
    }
    catch (err) {
        console.error('Erreur get notification:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.getNotificationById = getNotificationById;
const markAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const notification = yield prisma.notification.update({
            where: { id: Number(req.params.id) },
            data: { read: true },
        });
        return res.json({
            success: true,
            message: 'Marquée comme lue',
            data: notification,
        });
    }
    catch (err) {
        console.error('Erreur mark as read:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.markAsRead = markAsRead;
const deleteNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma.notification.delete({
            where: { id: Number(req.params.id) },
        });
        return res.json({ success: true, message: 'Supprimée avec succès' });
    }
    catch (err) {
        console.error('Erreur delete notification:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.deleteNotification = deleteNotification;
