"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
router.post('/logout', authMiddleware_1.authenticateToken, authController_1.logout);
router.post('/refresh', authMiddleware_1.authenticateToken, authController_1.refreshTokenHandler); // Corriger ici
router.post('/send-verification', authMiddleware_1.authenticateToken, authController_1.sendVerificationEmail);
router.get('/verify-email/:token', authController_1.verifyEmail);
router.post('/forgot-password', authController_1.forgotPassword);
router.post('/reset-password/:token', authController_1.resetPassword);
exports.default = router;
