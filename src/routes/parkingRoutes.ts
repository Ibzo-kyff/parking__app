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
router.post('/upload-logo', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'file', maxCount: 1 }]), (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const file = files?.logo?.[0] || files?.file?.[0];
  if (!file) {
    return res.status(400).json({ error: "Aucun fichier envoyé. Champs acceptés: 'logo' ou 'file'" });
  }
  const logoUrl = `/uploads/${file.filename}`;
  return res.status(201).json({ message: 'Logo uploadé avec succès', logoUrl });
});

export default router;
