// parkingRouter.ts (VERSION CORRIGÉE)
// Ajout du middleware authenticateToken sur POST et DELETE (manquant avant !)

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

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ROUTES AVEC AUTHENTIFICATION OBLIGATOIRE
router.post('/', authenticateToken, upload.single("logo"), createParking);
router.get('/', getAllParkings);
router.get('/me', authenticateToken, getMyParking);
router.get('/:id', getParkingById);
router.put('/:id', authenticateToken, upload.single("logo"), updateParking);
router.delete('/:id', authenticateToken, deleteParking);   // ← AJOUTÉ !

export default router;