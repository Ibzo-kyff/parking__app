"use strict";
// import { Request, Response } from 'express';
// import { PrismaClient, NotificationType } from '@prisma/client';
// import { pusher } from '../index';
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
exports.markMessageAsRead = exports.deleteMessage = exports.updateMessage = exports.getUserConversations = exports.getConversation = exports.sendMessage = void 0;
const client_1 = require("@prisma/client");
const index_1 = require("../index");
const sendNotification_1 = require("../utils/sendNotification");
const prisma = new client_1.PrismaClient();
// =====================
// ENVOYER UN MESSAGE
// =====================
const sendMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const senderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { receiverId, content, parkingId, clientTempId } = req.body;
        if (!senderId)
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        if (!receiverId || !(content === null || content === void 0 ? void 0 : content.trim()))
            return res.status(400).json({ message: 'receiverId et content sont obligatoires' });
        const [sender, receiver] = yield Promise.all([
            prisma.user.findUnique({ where: { id: senderId }, select: { role: true, nom: true, prenom: true } }),
            prisma.user.findUnique({ where: { id: receiverId }, select: { role: true } }),
        ]);
        if (!sender || !receiver)
            return res.status(404).json({ message: 'Utilisateur introuvable' });
        if (sender.role === receiver.role)
            return res.status(403).json({ message: 'Messages autorisés seulement entre client et parking' });
        if (parkingId) {
            const parking = yield prisma.parking.findUnique({ where: { id: parkingId } });
            if (!parking)
                return res.status(404).json({ message: 'Parking introuvable' });
        }
        const message = yield prisma.message.create({
            data: { senderId, receiverId, content: content.trim(), parkingId },
            include: { sender: true, receiver: true, parking: true },
        });
        const payload = Object.assign(Object.assign({}, message), { clientTempId });
        // 🔹 PUSHER
        yield Promise.all([
            index_1.pusher.trigger(`private-user-${receiverId}`, 'newMessage', payload),
            index_1.pusher.trigger(`private-user-${senderId}`, 'newMessage', payload),
        ]);
        // 🔹 NOTIFICATION PUSH
        const senderName = `${sender.nom || ''} ${sender.prenom || ''}`.trim() || 'Quelqu’un';
        (0, sendNotification_1.notifyUser)(receiverId, `Nouveau message de ${senderName}`, content.substring(0, 100), client_1.NotificationType.MESSAGE, { messageId: message.id, senderId, screen: 'Chat', parkingId: parkingId !== null && parkingId !== void 0 ? parkingId : undefined }).catch(() => { });
        // 🔹 NOTIFICATION DB
        yield prisma.notification.create({
            data: {
                userId: receiverId,
                title: `Nouveau message de ${senderName}`,
                message: content.substring(0, 100),
                type: 'MESSAGE',
            },
        });
        res.status(201).json(payload);
    }
    catch (error) {
        console.error('Erreur sendMessage:', error);
        res.status(500).json({ message: 'Erreur lors de l’envoi du message' });
    }
});
exports.sendMessage = sendMessage;
// =====================
// RÉCUPÉRER UNE CONVERSATION
// =====================
const getConversation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const otherUserId = parseInt(req.params.userId);
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const parkingId = req.query.parkingId ? parseInt(req.query.parkingId) : undefined;
        if (!userId)
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        const where = {
            OR: [
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId },
            ],
            deletedAt: null,
        };
        if (parkingId !== undefined)
            where.parkingId = parkingId;
        const [messages, total] = yield Promise.all([
            prisma.message.findMany({
                where,
                orderBy: { createdAt: 'asc' },
                include: { sender: true, receiver: true, parking: true },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.message.count({ where }),
        ]);
        res.json({ messages, totalPages: Math.ceil(total / pageSize), currentPage: page, parkingId });
    }
    catch (error) {
        console.error('Erreur getConversation:', error);
        res.status(500).json({ message: 'Erreur récupération conversation' });
    }
});
exports.getConversation = getConversation;
// === CONVERSATIONS GROUPÉES ===
const getUserConversations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId)
            return res.status(401).json({ message: 'Non authentifié' });
        const conversations = yield prisma.message.groupBy({
            by: ['senderId', 'receiverId'],
            where: { OR: [{ senderId: userId }, { receiverId: userId }], deletedAt: null },
            _max: { createdAt: true },
        });
        const latestMessages = yield prisma.message.findMany({
            where: {
                OR: conversations
                    .filter(c => c._max.createdAt !== null)
                    .map(c => ({
                    senderId: c.senderId,
                    receiverId: c.receiverId,
                    createdAt: c._max.createdAt,
                    deletedAt: null,
                })),
            },
            include: { sender: true, receiver: true, parking: true },
            orderBy: { createdAt: 'desc' },
        });
        const map = {};
        latestMessages.forEach(msg => {
            const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
            if (!map[otherId])
                map[otherId] = { user: msg.senderId === userId ? msg.receiver : msg.sender, lastMessage: msg };
        });
        res.json(Object.values(map));
    }
    catch (error) {
        console.error('Erreur getUserConversations:', error);
        res.status(500).json({ message: 'Erreur récupération conversations' });
    }
});
exports.getUserConversations = getUserConversations;
// =====================
// METTRE À JOUR UN MESSAGE
// =====================
const updateMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const messageId = parseInt(req.params.id);
        const { content } = req.body;
        if (!userId)
            return res.status(401).json({ message: 'Non authentifié' });
        if (!(content === null || content === void 0 ? void 0 : content.trim()))
            return res.status(400).json({ message: 'Contenu requis' });
        const message = yield prisma.message.findUnique({ where: { id: messageId } });
        if (!message)
            return res.status(404).json({ message: 'Message introuvable' });
        if (message.senderId !== userId)
            return res.status(403).json({ message: 'Accès refusé' });
        const updated = yield prisma.message.update({
            where: { id: messageId },
            data: { content: content.trim() },
            include: { sender: true, receiver: true, parking: true },
        });
        yield Promise.all([
            index_1.pusher.trigger(`private-user-${message.receiverId}`, 'updateMessage', updated),
            index_1.pusher.trigger(`private-user-${message.senderId}`, 'updateMessage', updated),
        ]);
        res.json(updated);
    }
    catch (error) {
        console.error('Erreur updateMessage:', error);
        res.status(500).json({ message: 'Erreur mise à jour' });
    }
});
exports.updateMessage = updateMessage;
// =====================
// SUPPRIMER UN MESSAGE
// =====================
const deleteMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const messageId = parseInt(req.params.id);
        if (!userId)
            return res.status(401).json({ message: 'Non authentifié' });
        const message = yield prisma.message.findUnique({ where: { id: messageId } });
        if (!message)
            return res.status(404).json({ message: 'Message introuvable' });
        if (message.senderId !== userId)
            return res.status(403).json({ message: 'Accès refusé' });
        yield prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
        yield Promise.all([
            index_1.pusher.trigger(`private-user-${message.receiverId}`, 'deleteMessage', messageId),
            index_1.pusher.trigger(`private-user-${message.senderId}`, 'deleteMessage', messageId),
        ]);
        res.json({ message: 'Message supprimé' });
    }
    catch (error) {
        console.error('Erreur deleteMessage:', error);
        res.status(500).json({ message: 'Erreur suppression' });
    }
});
exports.deleteMessage = deleteMessage;
// =====================
// MARQUER COMME LU
// =====================
const markMessageAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const messageId = parseInt(req.params.id);
        if (!userId)
            return res.status(401).json({ message: 'Non authentifié' });
        const message = yield prisma.message.findUnique({ where: { id: messageId } });
        if (!message)
            return res.status(404).json({ message: 'Message introuvable' });
        if (message.receiverId !== userId)
            return res.status(403).json({ message: 'Accès refusé' });
        const updated = yield prisma.message.update({
            where: { id: messageId },
            data: { read: true },
            include: { sender: true, receiver: true, parking: true },
        });
        yield Promise.all([
            index_1.pusher.trigger(`private-user-${message.senderId}`, 'messageRead', updated),
            index_1.pusher.trigger(`private-user-${message.receiverId}`, 'messageRead', updated),
        ]);
        res.json(updated);
    }
    catch (error) {
        console.error('Erreur markMessageAsRead:', error);
        res.status(500).json({ message: 'Erreur marquage lu' });
    }
});
exports.markMessageAsRead = markMessageAsRead;
