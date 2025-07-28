import express from 'express';
import { register, login, logout, verifyEmail, sendVerificationEmail, forgotPassword, resetPassword, refreshTokenHandler } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.post('/refresh', authenticateToken, refreshTokenHandler); // Corriger ici
router.post('/send-verification', authenticateToken, sendVerificationEmail);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
export default router;