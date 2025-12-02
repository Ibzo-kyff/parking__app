import express from 'express';
import {
  createParking,
  getAllParkings,
  getParkingById,
  getMyParking,
  updateParking,
  deleteParking
} from '../controllers/parkingController';
import multer from 'multer';
import { authenticateToken } from '../middleware/authMiddleware';
// Supprimez 'path' si plus utilisé, ou gardez-le si besoin ailleurs

const router = express.Router();

// Config Multer en mémoire (buffer) pour Vercel
const storage = multer.memoryStorage(); // Changement ici : pas de diskStorage
const upload = multer({ storage });

router.post('/', upload.single("logo"), createParking);
router.get('/', getAllParkings);
router.get('/me',authenticateToken, getMyParking);
router.put('/:id', authenticateToken,upload.single("logo"), updateParking);
router.delete('/:id', deleteParking);

export default router;