"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const messageController_1 = require("../controllers/messageController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.use(authMiddleware_1.authenticateToken);
router.post('/', messageController_1.sendMessage);
router.get('/conversation/:userId', messageController_1.getConversation);
router.get('/conversations', messageController_1.getUserConversations);
router.put('/:id', messageController_1.updateMessage);
router.delete('/:id', messageController_1.deleteMessage);
router.patch('/:id/read', messageController_1.markMessageAsRead);
exports.default = router;
