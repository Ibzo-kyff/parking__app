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
exports.markMessageAsRead = exports.deleteMessage = exports.updateMessage = exports.getUserConversations = exports.getConversation = exports.sendMessage = void 0;
const client_1 = require("@prisma/client");
const index_1 = require("../index"); // Importer Pusher
const prisma = new client_1.PrismaClient();
// ✅ Envoyer un message
const sendMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const senderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { receiverId, content, parkingId } = req.body;
        if (!senderId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        if (!receiverId || !content) {
            return res.status(400).json({ message: 'receiverId et content sont obligatoires' });
        }
        // Vérifier les rôles (client-parking)
        const sender = yield prisma.user.findUnique({ where: { id: senderId }, select: { role: true } });
        const receiver = yield prisma.user.findUnique({ where: { id: receiverId }, select: { role: true } });
        if ((sender === null || sender === void 0 ? void 0 : sender.role) === (receiver === null || receiver === void 0 ? void 0 : receiver.role)) {
            return res.status(403).json({ message: 'Les messages doivent être entre un client et un parking' });
        }
        // Vérifier si parkingId est valide (si fourni)
        if (parkingId) {
            const parkingExists = yield prisma.parking.findUnique({ where: { id: parkingId } });
            if (!parkingExists) {
                return res.status(404).json({ message: 'Parking introuvable' });
            }
        }
        const message = yield prisma.message.create({
            data: { senderId, receiverId, content, parkingId },
            include: { sender: true, receiver: true, parking: true },
        });
        // 🔔 Notification en temps réel avec Pusher
        yield index_1.pusher.trigger(`user_${receiverId}`, 'newMessage', message);
        yield index_1.pusher.trigger(`user_${senderId}`, 'newMessage', message);
        // Créer une notification pour le destinataire
        yield prisma.notification.create({
            data: {
                userId: receiverId,
                title: `Nouveau message de ${message.sender.nom} ${message.sender.prenom}`,
                message: content.substring(0, 100),
                type: 'MESSAGE',
            },
        });
        res.status(201).json(message);
    }
    catch (error) {
        console.error('Erreur sendMessage:', error);
        res.status(500).json({ message: 'Erreur lors de l’envoi du message', error });
    }
});
exports.sendMessage = sendMessage;
// ✅ Récupérer la conversation entre l’utilisateur connecté et un autre utilisateur
const getConversation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const otherUserId = parseInt(req.params.userId);
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        const messages = yield prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId },
                ],
                deletedAt: null, // Exclure les messages supprimés
            },
            orderBy: { createdAt: 'asc' },
            include: { sender: true, receiver: true, parking: true },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        const totalMessages = yield prisma.message.count({
            where: {
                OR: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId },
                ],
                deletedAt: null,
            },
        });
        res.json({
            messages,
            totalPages: Math.ceil(totalMessages / pageSize),
            currentPage: page,
        });
    }
    catch (error) {
        console.error('Erreur getConversation:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération de la conversation', error });
    }
});
exports.getConversation = getConversation;
// Récupérer toutes les conversations (groupées par utilisateur)
const getUserConversations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        // Récupérer le dernier message de chaque conversation
        const conversations = yield prisma.message.groupBy({
            by: ['senderId', 'receiverId'],
            where: { OR: [{ senderId: userId }, { receiverId: userId }], deletedAt: null },
            _max: { createdAt: true },
        });
        // Filtrer les conversations avec createdAt non null et mapper
        const latestMessages = yield prisma.message.findMany({
            where: {
                OR: conversations
                    .filter((conv) => conv._max.createdAt !== null) // Exclure les createdAt null
                    .map((conv) => ({
                    senderId: conv.senderId,
                    receiverId: conv.receiverId,
                    createdAt: conv._max.createdAt, // TypeScript sait que createdAt n'est pas null
                    deletedAt: null,
                })),
            },
            include: { sender: true, receiver: true, parking: true },
            orderBy: { createdAt: 'desc' },
        });
        // Regroupement par "autre utilisateur"
        const conversationsMap = {};
        latestMessages.forEach((msg) => {
            const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
            if (!conversationsMap[otherUserId]) {
                conversationsMap[otherUserId] = [];
            }
            conversationsMap[otherUserId].push(msg);
        });
        res.json(conversationsMap);
    }
    catch (error) {
        console.error('Erreur getUserConversations:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des conversations', error });
    }
});
exports.getUserConversations = getUserConversations;
// ✅ Mettre à jour un message
const updateMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const messageId = parseInt(req.params.id);
        const { content } = req.body;
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        if (!content || typeof content !== 'string' || content.trim() === '') {
            return res.status(400).json({ message: 'Le contenu du message est obligatoire' });
        }
        const message = yield prisma.message.findUnique({ where: { id: messageId } });
        if (!message) {
            return res.status(404).json({ message: 'Message introuvable' });
        }
        if (message.senderId !== userId) {
            return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres messages' });
        }
        const updatedMessage = yield prisma.message.update({
            where: { id: messageId },
            data: { content },
            include: { sender: true, receiver: true, parking: true },
        });
        // 🔔 Notifier les deux utilisateurs de la mise à jour
        yield index_1.pusher.trigger(`user_${message.receiverId}`, 'updateMessage', updatedMessage);
        yield index_1.pusher.trigger(`user_${message.senderId}`, 'updateMessage', updatedMessage);
        res.json(updatedMessage);
    }
    catch (error) {
        console.error('Erreur updateMessage:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du message', error });
    }
});
exports.updateMessage = updateMessage;
// ✅ Supprimer un message (soft delete)
const deleteMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const messageId = parseInt(req.params.id);
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        const message = yield prisma.message.findUnique({ where: { id: messageId } });
        if (!message) {
            return res.status(404).json({ message: 'Message introuvable' });
        }
        if (message.senderId !== userId) {
            return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres messages' });
        }
        const deletedMessage = yield prisma.message.update({
            where: { id: messageId },
            data: { deletedAt: new Date() },
            include: { sender: true, receiver: true, parking: true },
        });
        // 🔔 Notifier suppression aux deux utilisateurs
        yield index_1.pusher.trigger(`user_${message.receiverId}`, 'deleteMessage', messageId);
        yield index_1.pusher.trigger(`user_${message.senderId}`, 'deleteMessage', messageId);
        res.json({ message: 'Message supprimé avec succès' });
    }
    catch (error) {
        console.error('Erreur deleteMessage:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression du message', error });
    }
});
exports.deleteMessage = deleteMessage;
// ✅ Marquer un message comme lu
const markMessageAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const messageId = parseInt(req.params.id);
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        const message = yield prisma.message.findUnique({ where: { id: messageId } });
        if (!message) {
            return res.status(404).json({ message: 'Message introuvable' });
        }
        if (message.receiverId !== userId) {
            return res.status(403).json({ message: 'Vous ne pouvez marquer que vos messages reçus comme lus' });
        }
        const updatedMessage = yield prisma.message.update({
            where: { id: messageId },
            data: { read: true },
            include: { sender: true, receiver: true, parking: true },
        });
        // 🔔 Notifier les deux utilisateurs
        yield index_1.pusher.trigger(`user_${message.senderId}`, 'messageRead', updatedMessage);
        yield index_1.pusher.trigger(`user_${message.receiverId}`, 'messageRead', updatedMessage);
        res.json(updatedMessage);
    }
    catch (error) {
        console.error('Erreur markMessageAsRead:', error);
        res.status(500).json({ message: 'Erreur lors du marquage du message comme lu', error });
    }
});
exports.markMessageAsRead = markMessageAsRead;
