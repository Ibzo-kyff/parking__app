"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const uploadMiddleware_1 = __importDefault(require("../middleware/uploadMiddleware"));
const router = express_1.default.Router();
// Routes d'authentification
router.post('/register', uploadMiddleware_1.default.single('image'), authController_1.register);
router.post('/login', authController_1.login);
router.post('/logout', authMiddleware_1.authenticateToken, authController_1.logout);
router.post('/refresh', authController_1.refreshTokenHandler);
// Routes pour la vérification d'email
router.post('/send-verification-email', authMiddleware_1.authenticateToken, authController_1.sendVerificationEmail);
router.post('/verify-email-otp', authController_1.verifyEmailWithOTP);
router.post('/verify-reset-otp', authController_1.verifyResetOTP);
// Routes pour la réinitialisation de mot de passe
router.post('/forgot-password', authController_1.forgotPassword);
router.post('/reset-password', authController_1.resetPassword);
router.post('/users/push-token', authMiddleware_1.authenticateToken, authController_1.updatePushToken);
// Routes de gestion des utilisateurs
router.get('/users', authMiddleware_1.authenticateToken, authController_1.getAllUsers);
router.get('/users/me', authMiddleware_1.authenticateToken, authController_1.getCurrentUser); // Ajout pour récupérer les infos de l'utilisateur connecté
router.get('/users/:id', authMiddleware_1.authenticateToken, authController_1.getUserById);
router.put('/users/me', authMiddleware_1.authenticateToken, uploadMiddleware_1.default.single('image'), authController_1.updateCurrentUser); // Ajout pour mise à jour du profil de l'utilisateur connecté
router.put('/users/:id', authMiddleware_1.authenticateToken, uploadMiddleware_1.default.single('image'), authController_1.updateUser);
router.delete('/users/:id', authMiddleware_1.authenticateToken, authController_1.deleteUser);
exports.default = router;
