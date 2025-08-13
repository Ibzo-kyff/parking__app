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

const router = Router();

router.post('/', createVehicule);
router.get('/', getAllVehicules);
router.get('/:id', getVehiculeById);
router.put('/:id', updateVehicule);
router.delete('/:id', deleteVehicule);
router.get('/marques', getDistinctMarques);
router.get('/models', getDistinctModels);
router.get('/recent-parkings', getRecentParkings);

export default router;