import express from 'express';
import {
  createParking,
  getAllParkings,
  getParkingById,
  updateParking,
  deleteParking
} from '../controllers/parkingController';
import { upload } from '../middleware/validate';

const router = express.Router();

router.post('/', createParking);
router.get('/', getAllParkings);
router.get('/:id', getParkingById);
router.put('/:id', updateParking);
router.delete('/:id', deleteParking);
router.post('/upload-logo', upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier envoyé.' });
  }
  // Génère l'URL d'accès public
  const logoUrl = `/public/${req.file.filename}`;
  return res.status(201).json({ message: 'Logo uploadé avec succès', logoUrl });
});

export default router;
