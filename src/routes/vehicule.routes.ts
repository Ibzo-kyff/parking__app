import { Router } from 'express';
import {
  createVehicule,
  getAllVehicules,
  getVehiculeById,
  updateVehicule,
  deleteVehicule
} from '../controllers/vehicule.controller';

const router = Router();

router.post('/', createVehicule);
router.get('/', getAllVehicules);
router.get('/:id', getVehiculeById);
router.put('/:id', updateVehicule);
router.delete('/:id', deleteVehicule);

export default router;
