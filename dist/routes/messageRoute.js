"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/message.routes.ts
const express_1 = __importDefault(require("express"));
const messageController_1 = require("../controllers/messageController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// toutes les routes sont protégées
router.use(authMiddleware_1.authenticateToken);
// Envoyer un message
router.post('/', messageController_1.sendMessage);
// Récupérer une conversation avec un utilisateur
router.get('/conversation/:userId', messageController_1.getConversation);
// Récupérer toutes les conversations de l’utilisateur connecté
router.get('/conversations', messageController_1.getUserConversations);
// Supprimer un message
router.delete('/:id', messageController_1.deleteMessage);
exports.default = router;
