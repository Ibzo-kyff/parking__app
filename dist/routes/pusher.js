"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pusherController_1 = require("../controllers/pusherController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post('/auth/pusher', authMiddleware_1.authenticateToken, pusherController_1.pusherAuth);
router.post('/auth/push-token', authMiddleware_1.authenticateToken, pusherController_1.registerPushToken);
router.post('/pusher/webhook', pusherController_1.pusherWebhook);
exports.default = router;
