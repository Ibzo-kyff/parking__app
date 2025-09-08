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
exports.deleteMessage = exports.updateMessage = exports.getUserConversations = exports.getConversation = exports.sendMessage = void 0;
const client_1 = require("@prisma/client");
const index_1 = require("../index"); // ⚡ import de socket.io
const prisma = new client_1.PrismaClient();
// ✅ Envoyer un message
const sendMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const senderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { receiverId, content } = req.body;
        if (!senderId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        if (!receiverId || !content) {
            return res.status(400).json({ message: 'receiverId et content sont obligatoires' });
        }
        const message = yield prisma.message.create({
            data: { senderId, receiverId, content },
            include: { sender: true, receiver: true },
        });
        // 🔔 Notification en temps réel
        index_1.io.to(`user_${receiverId}`).emit("newMessage", message);
        index_1.io.to(`user_${senderId}`).emit("newMessage", message);
        res.status(201).json(message);
    }
    catch (error) {
        console.error("Erreur sendMessage:", error);
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
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        const messages = yield prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId },
                ],
            },
            orderBy: { createdAt: 'asc' },
            include: { sender: true, receiver: true },
        });
        res.json(messages);
    }
    catch (error) {
        console.error("Erreur getConversation:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération de la conversation', error });
    }
});
exports.getConversation = getConversation;
// ✅ Récupérer toutes les conversations (groupées par utilisateur)
const getUserConversations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        const messages = yield prisma.message.findMany({
            where: { OR: [{ senderId: userId }, { receiverId: userId }] },
            orderBy: { createdAt: 'desc' },
            include: { sender: true, receiver: true },
        });
        // 🔄 Regroupement par "autre utilisateur"
        const conversations = {};
        messages.forEach((msg) => {
            const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
            if (!conversations[otherUserId]) {
                conversations[otherUserId] = [];
            }
            conversations[otherUserId].push(msg);
        });
        res.json(conversations);
    }
    catch (error) {
        console.error("Erreur getUserConversations:", error);
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
            include: { sender: true, receiver: true },
        });
        // 🔔 Notifier les deux utilisateurs de la mise à jour
        index_1.io.to(`user_${message.receiverId}`).emit("updateMessage", updatedMessage);
        index_1.io.to(`user_${message.senderId}`).emit("updateMessage", updatedMessage);
        res.json(updatedMessage);
    }
    catch (error) {
        console.error("Erreur updateMessage:", error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du message', error });
    }
});
exports.updateMessage = updateMessage;
// ✅ Supprimer un message
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
        yield prisma.message.delete({ where: { id: messageId } });
        // 🔔 Notifier suppression aux deux utilisateurs
        index_1.io.to(`user_${message.receiverId}`).emit("deleteMessage", messageId);
        index_1.io.to(`user_${message.senderId}`).emit("deleteMessage", messageId);
        res.json({ message: 'Message supprimé avec succès' });
    }
    catch (error) {
        console.error("Erreur deleteMessage:", error);
        res.status(500).json({ message: 'Erreur lors de la suppression du message', error });
    }
});
exports.deleteMessage = deleteMessage;
