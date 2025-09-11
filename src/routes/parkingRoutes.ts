import express from 'express';
import {
  createParking,
  getAllParkings,
  getParkingById,
  updateParking,
  deleteParking
} from '../controllers/parkingController';
import multer from 'multer';
// Supprimez 'path' si plus utilisé, ou gardez-le si besoin ailleurs

const router = express.Router();

// Config Multer en mémoire (buffer) pour Vercel
const storage = multer.memoryStorage(); // Changement ici : pas de diskStorage
const upload = multer({ storage });

router.post('/', upload.single("logo"), createParking);
router.get('/', getAllParkings);
router.get('/:id', getParkingById);
router.put('/:id', upload.single("logo"), updateParking);
router.delete('/:id', deleteParking);

export default router;