"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pusherAuth = void 0;
const index_1 = require("../index");
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
