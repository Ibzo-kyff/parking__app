import { Router } from 'express';
import {
  createVehicleHistory,
  getAllVehicleHistories,
  getVehicleHistoryById,
  updateVehicleHistory,
  deleteVehicleHistory
} from '../controllers/vehicleHistory.controller';

const router = Router();

router.post('/', createVehicleHistory);
router.get('/', getAllVehicleHistories);
router.get('/:id', getVehicleHistoryById);
router.put('/:id', updateVehicleHistory);
router.delete('/:id', deleteVehicleHistory);

export default router;
