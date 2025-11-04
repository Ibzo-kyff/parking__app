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
exports.notifyParkingOwner = exports.notifyUser = void 0;
// utils/sendNotification.ts
const client_1 = require("@prisma/client");
const expo_server_sdk_1 = require("expo-server-sdk");
// === Initialisation ===
const prisma = new client_1.PrismaClient();
const expo = new expo_server_sdk_1.Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
// === Fonction privée d'envoi push (dupliquée ici pour éviter couplage) ===
const sendPush = (token, title, body, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!token || !expo_server_sdk_1.Expo.isExpoPushToken(token)) {
        console.warn('Token Expo invalide ou manquant:', token);
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
        console.log('Push envoyé:', { title, token, receipt: receipts[0] });
        return receipts[0];
    }
    catch (error) {
        console.error('Erreur envoi push:', error.message);
        return null;
    }
});
// === NOTIFIER UN UTILISATEUR ===
const notifyUser = (userId_1, title_1, message_1, type_1, ...args_1) => __awaiter(void 0, [userId_1, title_1, message_1, type_1, ...args_1], void 0, function* (userId, title, message, type, data = {}) {
    try {
        // Récupérer le token + créer la notif en parallèle
        const [user, notification] = yield Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { expoPushToken: true },
            }),
            prisma.notification.create({
                data: {
                    title,
                    message,
                    type,
                    userId,
                },
            }),
        ]);
        // Envoyer le push si token valide
        if (user === null || user === void 0 ? void 0 : user.expoPushToken) {
            yield sendPush(user.expoPushToken, title, message, Object.assign({ notificationId: notification.id }, data));
        }
        else {
            console.info('Aucun token Expo pour userId:', userId);
        }
        return notification;
    }
    catch (error) {
        console.error('Erreur notifyUser:', error);
        throw new Error('Échec envoi notification utilisateur');
    }
});
exports.notifyUser = notifyUser;
// === NOTIFIER LE PROPRIÉTAIRE D'UN PARKING ===
const notifyParkingOwner = (parkingId_1, title_1, message_1, type_1, ...args_1) => __awaiter(void 0, [parkingId_1, title_1, message_1, type_1, ...args_1], void 0, function* (parkingId, title, message, type, data = {}) {
    var _a;
    try {
        const [parking, notification] = yield Promise.all([
            prisma.parking.findUnique({
                where: { id: parkingId },
                select: {
                    user: {
                        select: { expoPushToken: true },
                    },
                },
            }),
            prisma.notification.create({
                data: {
                    title,
                    message,
                    type,
                    parkingId,
                },
            }),
        ]);
        const token = (_a = parking === null || parking === void 0 ? void 0 : parking.user) === null || _a === void 0 ? void 0 : _a.expoPushToken;
        if (token) {
            yield sendPush(token, title, message, Object.assign({ notificationId: notification.id }, data));
        }
        else {
            console.info('Aucun token pour le propriétaire du parking:', parkingId);
        }
        return notification;
    }
    catch (error) {
        console.error('Erreur notifyParkingOwner:', error);
        throw new Error('Échec envoi notification parking');
    }
});
exports.notifyParkingOwner = notifyParkingOwner;
