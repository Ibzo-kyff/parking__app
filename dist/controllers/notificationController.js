"use strict";
// // src/controllers/notificationController.ts
// import {  Response } from 'express'; // ← AVANT
// import { PrismaClient, NotificationType } from '@prisma/client';
// import { z } from 'zod';
// import { Expo } from 'expo-server-sdk';
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
const sendNotification_1 = require("../utils/sendNotification");
const prisma = new client_1.PrismaClient();
// === SCHÉMA DE VALIDATION ===
const createNotificationSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(100),
    message: zod_1.z.string().min(5).max(500),
    type: zod_1.z.nativeEnum(client_1.NotificationType),
    userId: zod_1.z.number().optional(),
    parkingId: zod_1.z.number().optional(),
});
// === VÉRIFIER PROPRIÉTÉ DE LA NOTIFICATION ===
// 🟢 Ajout du paramètre "role" pour autoriser l'ADMIN
const checkNotificationOwnership = (notificationId, userId, role) => __awaiter(void 0, void 0, void 0, function* () {
    if (role === 'ADMIN') {
        return yield prisma.notification.findUnique({ where: { id: notificationId } });
    }
    return yield prisma.notification.findFirst({
        where: {
            id: notificationId,
            OR: [
                { userId }, // Notification directe à l'utilisateur
                { parking: { userId } }, // Notification au parking → propriétaire
            ],
        },
    });
});
// === CRÉER UNE NOTIFICATION (admin/système) ===
const createNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const data = createNotificationSchema.parse(req.body);
        const { userId, parkingId, title, message, type } = data;
        // Validation : un seul des deux
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
                user: { select: { id: true, expoPushToken: true, role: true } },
                parking: { select: { id: true, user: { select: { expoPushToken: true, role: true } } } },
            },
        });
        // Récupérer le token Expo
        let token = null;
        if (userId && ((_a = notification.user) === null || _a === void 0 ? void 0 : _a.expoPushToken)) {
            token = notification.user.expoPushToken;
        }
        else if (parkingId && ((_c = (_b = notification.parking) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.expoPushToken)) {
            token = notification.parking.user.expoPushToken;
        }
        const recipientRole = userId ? (_d = notification.user) === null || _d === void 0 ? void 0 : _d.role : (_f = (_e = notification.parking) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.role;
        const url = recipientRole === 'PARKING'
            ? '/dashboard/parking/notifications'
            : recipientRole === 'ADMIN'
                ? '/dashboard/admin/notifications'
                : '/dashboard/client/notifications';
        // Envoyer push
        if (token) {
            yield (0, sendNotification_1.sendPushNotification)(token, title, message, {
                notificationId: notification.id,
                type,
                screen: userId ? 'UserNotifications' : 'ParkingDetails',
                url,
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
// === LISTE DES NOTIFICATIONS ===
// 🟢 L'Admin reçoit tout ! Le Client/Parking est restreint
const getNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const role = req.user.role; // Récupère le rôle du token (ADMIN, CLIENT, PARKING...)
        const { read, type } = req.query;
        let whereClause = Object.assign(Object.assign({}, (read !== undefined && { read: read === 'true' })), (type && { type: type }));
        // Si pas ADMIN, imposer le filtre strict par profil
        if (role !== 'ADMIN') {
            whereClause.OR = [
                { userId },
                { parking: { userId } },
            ];
        }
        const notifications = yield prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, email: true, nom: true, prenom: true } },
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
// === DÉTAIL D'UNE NOTIFICATION ===
const getNotificationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const notificationId = Number(req.params.id);
        console.log(`[DEBUG] User ID: ${userId} | Notification ID: ${notificationId}`);
        // 🟢 On passe le rôle pour autoriser la lecture à l'Admin
        const notification = yield checkNotificationOwnership(notificationId, userId, role);
        if (!notification) {
            console.log('[DEBUG] Accès refusé ou notification inexistante');
            return res.status(404).json({ error: 'Notification non trouvée ou accès refusé' });
        }
        const fullNotification = yield prisma.notification.findUnique({
            where: { id: notificationId },
            include: {
                user: { select: { id: true, email: true, nom: true, prenom: true } },
                parking: {
                    select: {
                        id: true,
                        name: true,
                        user: { select: { id: true, email: true } },
                    },
                },
            },
        });
        return res.json({ success: true, data: fullNotification });
    }
    catch (err) {
        console.error('Erreur get notification:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.getNotificationById = getNotificationById;
// === MARQUER COMME LUE ===
const markAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const notificationId = Number(req.params.id);
        // 🟢 On passe le rôle pour contourner le blocage
        const notification = yield checkNotificationOwnership(notificationId, userId, role);
        if (!notification) {
            return res.status(404).json({ error: 'Notification non trouvée ou accès refusé' });
        }
        const updated = yield prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });
        return res.json({ success: true, message: 'Marquée comme lue', data: updated });
    }
    catch (err) {
        console.error('Erreur mark as read:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.markAsRead = markAsRead;
// === SUPPRIMER UNE NOTIFICATION ===
const deleteNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const notificationId = Number(req.params.id);
        // 🟢 On passe le rôle pour autoriser la suppression aux Admin
        const notification = yield checkNotificationOwnership(notificationId, userId, role);
        if (!notification) {
            return res.status(404).json({ error: 'Notification non trouvée ou accès refusé' });
        }
        yield prisma.notification.delete({ where: { id: notificationId } });
        return res.json({ success: true, message: 'Supprimée avec succès' });
    }
    catch (err) {
        console.error('Erreur delete notification:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.deleteNotification = deleteNotification;
