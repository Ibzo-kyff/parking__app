import { Router } from 'express';
import {
  createVehicule,
  getAllVehicules,
  getVehiculeById,
  updateVehicule,
  deleteVehicule
} from '../controllers/vehicule.controller';

import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Routes publiques (lecture)
router.get('/', getAllVehicules);
router.get('/:id', getVehiculeById);

// Routes protégées (création, modification, suppression)
router.post('/', authenticateToken, createVehicule);
router.put('/:id', authenticateToken, updateVehicule);
router.delete('/:id', authenticateToken, deleteVehicule);

export default router;
