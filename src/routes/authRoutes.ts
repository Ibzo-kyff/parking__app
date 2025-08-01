import express from 'express';
import { register, login, logout, verifyEmail, sendVerificationEmail, forgotPassword, resetPassword, refreshTokenHandler, getAllUsers, getUserById, updateUser, deleteUser } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.post('/refresh', refreshTokenHandler);
router.post('/send-verification', authenticateToken, sendVerificationEmail);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Nouvelles routes pour la gestion des utilisateurs
router.get('/users', authenticateToken, getAllUsers); // Récupérer tous les utilisateurs
router.get('/users/:id', authenticateToken, getUserById); // Récupérer un utilisateur par ID
router.put('/users/:id', authenticateToken, updateUser); // Mettre à jour un utilisateur
router.delete('/users/:id', authenticateToken, deleteUser); // Supprimer un utilisateur

export default router;