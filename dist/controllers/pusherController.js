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
exports.registerPushToken = exports.pusherAuth = void 0;
const index_1 = require("../index");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const pusherAuth = (req, res) => {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            return res.status(401).json({ message: 'Non authentifié' });
        }
        const socketId = req.body.socket_id;
        const channel = req.body.channel_name;
        const authResponse = index_1.pusher.authorizeChannel(socketId, channel, { user_id: String(req.user.id) });
        res.send(authResponse);
    }
    catch (error) {
        console.error('Erreur auth pusher:', error);
        res.status(403).json({ message: 'Pusher auth failed' });
    }
};
exports.pusherAuth = pusherAuth;
const registerPushToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { token } = req.body;
    if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
        return res.status(401).json({ message: 'Non authentifié' });
    }
    if (!token) {
        return res.status(400).json({ message: 'Token manquant' });
    }
    yield prisma.user.update({
        where: { id: req.user.id },
        data: { expoPushToken: token },
    });
    res.json({ success: true });
});
exports.registerPushToken = registerPushToken;
