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
router.post('/refresh', authController_1.refreshTokenHandler);
router.post('/send-verification', authMiddleware_1.authenticateToken, authController_1.sendVerificationEmail);
router.get('/verify-email/:token', authController_1.verifyEmail);
router.post('/forgot-password', authController_1.forgotPassword);
router.post('/reset-password/:token', authController_1.resetPassword);
// Nouvelles routes pour la gestion des utilisateurs
router.get('/users', authMiddleware_1.authenticateToken, authController_1.getAllUsers); // Récupérer tous les utilisateurs
router.get('/users/:id', authMiddleware_1.authenticateToken, authController_1.getUserById); // Récupérer un utilisateur par ID
router.put('/users/:id', authMiddleware_1.authenticateToken, authController_1.updateUser); // Mettre à jour un utilisateur
router.delete('/users/:id', authMiddleware_1.authenticateToken, authController_1.deleteUser); // Supprimer un utilisateur
exports.default = router;
