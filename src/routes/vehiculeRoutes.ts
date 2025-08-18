import { Router } from 'express';
import {
  createVehicule,
  getAllVehicules,
  getVehiculeById,
  updateVehicule,
  deleteVehicule,
  getDistinctMarques,
  getDistinctModels,
  getRecentParkings
} from '../controllers/vehiculeController';
import { upload } from '../middleware/validate';

const router = Router();

router.post('/', createVehicule);
router.get('/', getAllVehicules);
router.get('/:id', getVehiculeById);
router.put('/:id', updateVehicule);
router.delete('/:id', deleteVehicule);
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier envoyé.' });
  }
  // Génère l'URL d'accès public
  const imageUrl = `/public/${req.file.filename}`;
  return res.status(201).json({ message: 'Image uploadée avec succès', imageUrl });
});
router.get('/marques', getDistinctMarques);
router.get('/models', getDistinctModels);
router.get('/recent-parkings', getRecentParkings);

export default router;