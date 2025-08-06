"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notificationContoller_1 = require("../controllers/notificationContoller");
const router = express_1.default.Router();
// Routes pour les notifications
router.post('/', notificationContoller_1.createNotification);
router.get('/', notificationContoller_1.getNotifications);
router.get('/:id', notificationContoller_1.getNotificationById);
router.patch('/:id/read', notificationContoller_1.markAsRead);
router.delete('/:id', notificationContoller_1.deleteNotification);
exports.default = router;
