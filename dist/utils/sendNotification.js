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
exports.notifyAdmins = exports.notifyParkingOwner = exports.notifyUser = exports.sendPushNotification = void 0;
// utils/sendNotification.ts - Hybride Expo (Mobile) + Firebase (Web Push Dashboard)
const client_1 = require("@prisma/client");
const expo_server_sdk_1 = require("expo-server-sdk");
const firebaseAdmin_1 = require("./firebaseAdmin");
const prisma = new client_1.PrismaClient();
const expo = new expo_server_sdk_1.Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
const sendPushNotification = (token_1, title_1, body_1, ...args_1) => __awaiter(void 0, [token_1, title_1, body_1, ...args_1], void 0, function* (token, title, body, data = {}) {
    var _a;
    if (!token) {
        return null;
    }
    // 1. Si c'est un token Expo (commence par ExponentPushToken[...] ou ExpoPushToken[...])
    if (expo_server_sdk_1.Expo.isExpoPushToken(token)) {
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
            // Nettoyage token périmé
            const receipt = receipts[0];
            if (receipt.status === 'error' && ((_a = receipt.details) === null || _a === void 0 ? void 0 : _a.error) === 'DeviceNotRegistered') {
                yield prisma.user.updateMany({
                    where: { expoPushToken: token },
                    data: { expoPushToken: null },
                });
            }
            return receipt;
        }
        catch (error) {
            console.error('Erreur envoi push Expo:', error.message);
            return null;
        }
    }
    // 2. Sinon, c'est un token Firebase Web (FCM)
    try {
        return yield (0, firebaseAdmin_1.sendFirebasePush)(token, title, body, data);
    }
    catch (error) {
        console.error('Erreur envoi push Firebase:', error.message);
        return null;
    }
});
exports.sendPushNotification = sendPushNotification;
// === NOTIFIER UN UTILISATEUR (PUSH + BDD) ===
const notifyUser = (userId_1, title_1, message_1, type_1, ...args_1) => __awaiter(void 0, [userId_1, title_1, message_1, type_1, ...args_1], void 0, function* (userId, title, message, type, data = {}) {
    try {
        // 1. Créer la notification en BDD (pour l'historique)
        const notification = yield prisma.notification.create({
            data: {
                title,
                message,
                type,
                userId,
            },
        });
        // 2. Récupérer le token pour push
        const user = yield prisma.user.findUnique({
            where: { id: userId },
            select: { expoPushToken: true },
        });
        // 3. Envoyer push (Expo ou Firebase selon le token enregistré)
        if (user === null || user === void 0 ? void 0 : user.expoPushToken) {
            yield (0, exports.sendPushNotification)(user.expoPushToken, title, message, Object.assign({ notificationId: notification.id }, data));
        }
        return notification;
    }
    catch (error) {
        console.error('Erreur notifyUser:', error);
        throw error;
    }
});
exports.notifyUser = notifyUser;
// === NOTIFIER LE PROPRIÉTAIRE D'UN PARKING (PUSH + BDD) ===
const notifyParkingOwner = (parkingId_1, title_1, message_1, type_1, ...args_1) => __awaiter(void 0, [parkingId_1, title_1, message_1, type_1, ...args_1], void 0, function* (parkingId, title, message, type, data = {}) {
    try {
        // 1. Récupérer l'utilisateur propriétaire
        const parking = yield prisma.parking.findUnique({
            where: { id: parkingId },
            include: { user: true },
        });
        if (!(parking === null || parking === void 0 ? void 0 : parking.user))
            return null;
        // 2. Créer la notification en BDD
        const notification = yield prisma.notification.create({
            data: {
                title,
                message,
                type,
                parkingId,
                userId: parking.user.id, // Associer aussi à l'utilisateur
            },
        });
        // 3. Envoyer push au parking si token valide
        if (parking.user.expoPushToken) {
            yield (0, exports.sendPushNotification)(parking.user.expoPushToken, title, message, Object.assign({ notificationId: notification.id }, data));
        }
        return notification;
    }
    catch (error) {
        console.error('Erreur notifyParkingOwner:', error);
        throw error;
    }
});
exports.notifyParkingOwner = notifyParkingOwner;
// === NOTIFIER TOUS LES ADMINISTRATEURS (PUSH + BDD) ===
const notifyAdmins = (title_1, message_1, type_1, ...args_1) => __awaiter(void 0, [title_1, message_1, type_1, ...args_1], void 0, function* (title, message, type, data = {}) {
    try {
        const admins = yield prisma.user.findMany({
            where: { role: client_1.Role.ADMIN },
            select: { id: true, expoPushToken: true },
        });
        for (const admin of admins) {
            // 1. Créer la notification en BDD pour chaque admin
            const notification = yield prisma.notification.create({
                data: {
                    title,
                    message,
                    type,
                    userId: admin.id,
                },
            });
            // 2. Envoyer le push si token présent
            if (admin.expoPushToken) {
                yield (0, exports.sendPushNotification)(admin.expoPushToken, title, message, Object.assign({ notificationId: notification.id }, data));
            }
        }
    }
    catch (error) {
        console.error('Erreur notifyAdmins:', error);
    }
});
exports.notifyAdmins = notifyAdmins;
