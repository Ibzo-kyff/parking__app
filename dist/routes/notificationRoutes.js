"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const notificationController_1 = require("../controllers/notificationController");
const router = express_1.default.Router();
router.post("/", authMiddleware_1.authenticateToken, notificationController_1.createNotification);
router.get("/", authMiddleware_1.authenticateToken, notificationController_1.getNotifications);
router.patch("/:id/read", authMiddleware_1.authenticateToken, notificationController_1.markAsRead);
router.delete("/:id", authMiddleware_1.authenticateToken, notificationController_1.deleteNotification);
exports.default = router;
