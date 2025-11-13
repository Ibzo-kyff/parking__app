"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/notificationRoutes.ts
const express_1 = __importDefault(require("express"));
const notificationController_1 = require("../controllers/notificationController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// === DEBUG : Vérifie que les handlers existent ===
console.log('Handlers loaded:', {
    getNotifications: typeof notificationController_1.getNotifications,
    authenticateToken: typeof authMiddleware_1.authenticateToken,
});
// === ROUTES PROTÉGÉES ===
router.get('/', authMiddleware_1.authenticateToken, notificationController_1.getNotifications);
router.get('/:id', authMiddleware_1.authenticateToken, notificationController_1.getNotificationById);
router.patch('/:id/read', authMiddleware_1.authenticateToken, notificationController_1.markAsRead);
router.delete('/:id', authMiddleware_1.authenticateToken, notificationController_1.deleteNotification);
// === CRÉATION (peut être publique ou admin) ===
router.post('/', notificationController_1.createNotification); // ou: authenticateToken, createNotification
exports.default = router;
