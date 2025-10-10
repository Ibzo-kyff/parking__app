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
exports.getUserConversation = exports.getParkingConversation = exports.markMessagesAsRead = exports.deleteMessage = exports.updateMessage = exports.getUserConversations = exports.getConversation = exports.sendMessage = void 0;
const client_1 = require("@prisma/client");
const index_1 = require("../index"); // ⚡ import de socket.io
const prisma = new client_1.PrismaClient();
// ✅ Envoyer un message (adapté pour les parkings)
const sendMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const senderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { receiverId, content, parkingId } = req.body;
        if (!senderId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        if (!content) {
            return res.status(400).json({ message: 'content est obligatoire' });
        }
        let finalReceiverId = receiverId;
        // 🏢 Si c'est une conversation de parking, trouver le gestionnaire
        if (parkingId) {
            const parking = yield prisma.parking.findUnique({
                where: { id: parkingId },
                include: { user: true }
            });
            if (!parking) {
                return res.status(404).json({ message: 'Parking introuvable' });
            }
            if (!parking.user) {
                return res.status(400).json({ message: 'Aucun gestionnaire associé à ce parking' });
            }
            finalReceiverId = parking.user.id;
        }
        else if (!receiverId) {
            return res.status(400).json({ message: 'receiverId ou parkingId est obligatoire' });
        }
        const message = yield prisma.message.create({
            data: {
                senderId,
                receiverId: finalReceiverId,
                content,
                parkingId: parkingId || null
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                parking: {
                    select: {
                        id: true,
                        name: true,
                        logo: true
                    }
                }
            },
        });
        // 🔔 Notification en temps réel
        index_1.io.to(`user_${finalReceiverId}`).emit("newMessage", message);
        index_1.io.to(`user_${senderId}`).emit("newMessage", message);
        res.status(201).json(message);
    }
    catch (error) {
        console.error("Erreur sendMessage:", error);
        res.status(500).json({ message: 'Erreur lors de l\'envoi du message', error });
    }
});
exports.sendMessage = sendMessage;
// ✅ Récupérer la conversation (adapté pour les parkings)
const getConversation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const otherUserId = parseInt(req.params.userId);
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        let whereClause = {
            OR: [
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId },
            ],
        };
        // 🏢 Si l'ID correspond à un parking, adapter la requête
        const parking = yield prisma.parking.findUnique({
            where: { id: otherUserId },
            include: { user: true }
        });
        if (parking && parking.user) {
            // C'est un parking, chercher les messages avec le gestionnaire
            whereClause = {
                OR: [
                    { senderId: userId, receiverId: parking.user.id, parkingId: otherUserId },
                    { senderId: parking.user.id, receiverId: userId, parkingId: otherUserId },
                ],
            };
        }
        const messages = yield prisma.message.findMany({
            where: whereClause,
            orderBy: { createdAt: 'asc' },
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                parking: {
                    select: {
                        id: true,
                        name: true,
                        logo: true
                    }
                }
            },
        });
        res.json(messages);
    }
    catch (error) {
        console.error("Erreur getConversation:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération de la conversation', error });
    }
});
exports.getConversation = getConversation;
// ✅ Récupérer toutes les conversations (adapté pour les parkings)
const getUserConversations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        // Récupérer tous les messages où l'utilisateur est impliqué
        const messages = yield prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId },
                    { receiverId: userId }
                ]
            },
            orderBy: { createdAt: 'desc' },
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                parking: {
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        city: true
                    }
                }
            },
        });
        const conversationsMap = new Map();
        messages.forEach((msg) => {
            let conversationKey;
            let conversationType = 'user';
            let targetId;
            if (msg.parkingId) {
                // Conversation de parking
                conversationKey = `parking_${msg.parkingId}`;
                conversationType = 'parking';
                targetId = msg.parkingId;
            }
            else {
                // Conversation directe avec un utilisateur
                const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
                conversationKey = `user_${otherUserId}`;
                targetId = otherUserId;
            }
            if (!conversationsMap.has(conversationKey)) {
                const conversation = {
                    id: conversationKey,
                    type: conversationType,
                    lastMessage: msg,
                    unreadCount: 0,
                    messages: [msg]
                };
                if (conversationType === 'parking' && msg.parking) {
                    conversation.parking = msg.parking;
                }
                else if (conversationType === 'user') {
                    const targetUser = msg.senderId === userId ? msg.receiver : msg.sender;
                    conversation.targetUser = targetUser;
                }
                conversationsMap.set(conversationKey, conversation);
            }
            else {
                const existingConversation = conversationsMap.get(conversationKey);
                existingConversation.messages.push(msg);
                // Mettre à jour le dernier message si nécessaire
                if (new Date(msg.createdAt) > new Date(existingConversation.lastMessage.createdAt)) {
                    existingConversation.lastMessage = msg;
                }
            }
            // Compter les messages non lus
            const conversation = conversationsMap.get(conversationKey);
            if (!msg.read && msg.receiverId === userId) {
                conversation.unreadCount++;
            }
        });
        // Convertir la Map en tableau et trier par date du dernier message
        const conversations = Array.from(conversationsMap.values()).sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
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
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                parking: {
                    select: {
                        id: true,
                        name: true,
                        logo: true
                    }
                }
            },
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
// ✅ Marquer les messages comme lus
const markMessagesAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { conversationId, type } = req.body; // type: 'user' ou 'parking'
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        let whereClause = {
            receiverId: userId,
            read: false
        };
        if (type === 'user' && conversationId) {
            whereClause.senderId = parseInt(conversationId);
            whereClause.parkingId = null;
        }
        else if (type === 'parking' && conversationId) {
            const parking = yield prisma.parking.findUnique({
                where: { id: parseInt(conversationId) },
                include: { user: true }
            });
            if (parking && parking.user) {
                whereClause.senderId = parking.user.id;
                whereClause.parkingId = parseInt(conversationId);
            }
        }
        yield prisma.message.updateMany({
            where: whereClause,
            data: { read: true }
        });
        res.json({ message: 'Messages marqués comme lus' });
    }
    catch (error) {
        console.error("Erreur markMessagesAsRead:", error);
        res.status(500).json({ message: 'Erreur lors du marquage des messages comme lus', error });
    }
});
exports.markMessagesAsRead = markMessagesAsRead;
// ✅ Récupérer la conversation avec un parking spécifique
const getParkingConversation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const parkingId = parseInt(req.params.parkingId);
        if (!userId) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }
        // Vérifier que le parking existe et récupérer le gestionnaire
        const parking = yield prisma.parking.findUnique({
            where: { id: parkingId },
            include: { user: true }
        });
        if (!parking) {
            return res.status(404).json({ message: 'Parking introuvable' });
        }
        if (!parking.user) {
            return res.status(400).json({ message: 'Aucun gestionnaire associé à ce parking' });
        }
        const messages = yield prisma.message.findMany({
            where: {
                OR: [
                    {
                        senderId: userId,
                        receiverId: parking.user.id,
                        parkingId: parkingId
                    },
                    {
                        senderId: parking.user.id,
                        receiverId: userId,
                        parkingId: parkingId
                    },
                ],
            },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                parking: {
                    select: {
                        id: true,
                        name: true,
                        logo: true
                    }
                }
            },
        });
        res.json(messages);
    }
    catch (error) {
        console.error("Erreur getParkingConversation:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération de la conversation avec le parking', error });
    }
});
exports.getParkingConversation = getParkingConversation;
// ✅ Récupérer la conversation avec un utilisateur spécifique (version améliorée)
const getUserConversation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
                    { senderId: userId, receiverId: otherUserId, parkingId: null },
                    { senderId: otherUserId, receiverId: userId, parkingId: null },
                ],
            },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        prenom: true,
                        role: true,
                        image: true
                    }
                }
            },
        });
        res.json(messages);
    }
    catch (error) {
        console.error("Erreur getUserConversation:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération de la conversation', error });
    }
});
exports.getUserConversation = getUserConversation;
