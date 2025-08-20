import express from 'express';
import { 
  register, 
  login, 
  logout, 
  sendVerificationEmail, 
  verifyEmailWithOTP, 
  verifyResetOTP,
  forgotPassword, 
  resetPassword, 
  refreshTokenHandler, 
  getAllUsers, 
  getUserById,
  getCurrentUser,
  updateCurrentUser, 
  updateUser, 
  deleteUser 
} from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Routes d'authentification
router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.post('/refresh', refreshTokenHandler);

// Routes pour la vérification d'email
router.post('/send-verification-email', authenticateToken, sendVerificationEmail);
router.post('/verify-email-otp', verifyEmailWithOTP); 
router.post('/verify-reset-otp', verifyResetOTP);

// Routes pour la réinitialisation de mot de passe
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Routes de gestion des utilisateurs
router.get('/users', authenticateToken, getAllUsers);
router.get('/users/me', authenticateToken, getCurrentUser); // Ajout pour récupérer les infos de l'utilisateur connecté
router.get('/users/:id', authenticateToken, getUserById);
router.put('/users/me', authenticateToken, updateCurrentUser); // Ajout pour mise à jour du profil de l'utilisateur connecté
router.put('/users/:id', authenticateToken, updateUser);
router.delete('/users/:id', authenticateToken, deleteUser);

export default router;