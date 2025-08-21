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

// Routes spécifiques d'abord
router.get('/marques', getDistinctMarques);
router.get('/models', getDistinctModels);
router.get('/recent-parkings', getRecentParkings);

// Routes générales ensuite
router.post('/', createVehicule);
router.get('/', getAllVehicules);
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier envoyé.' });
  }
  const imageUrl = `/public/${req.file.filename}`;
  return res.status(201).json({ message: 'Image uploadée avec succès', imageUrl });
});

// Routes paramétrées en dernier
router.get('/:id', getVehiculeById);
router.put('/:id', updateVehicule);
router.delete('/:id', deleteVehicule);

export default router;