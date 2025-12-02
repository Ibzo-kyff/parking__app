import express from 'express';
import {
  createReservation,
  getAllReservations,
  getUserReservations,
  getReservation,
  cancelReservation,
  updateReservation,
  getAllReservationsForParking,
  acceptReservation,
} from '../controllers/reservationController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Routes protégées
router.use(authenticateToken);

router.post('/', createReservation);
router.get('/', getUserReservations);
router.get('/:id', getReservation);
router.delete('/:id', cancelReservation);

// --- PARKING ---
router.get('/parking/all', getAllReservationsForParking);
router.post('/:id/accept', acceptReservation);

// Routes admin seulement
router.get('/admin/all', getAllReservations);
router.put('/admin/:id', updateReservation);
export default router;