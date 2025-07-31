import express from 'express';
import {
  createVehicleStats,
  getVehicleStats,
  updateVehicleStats,
  deleteVehicleStats,
} from '../controllers/vehicleStats.controller';

const router = express.Router();

// POST /api/vehicle-stats
router.post('/', createVehicleStats);

// GET /api/vehicle-stats/:vehicleId
router.get('/:vehicleId', getVehicleStats);

// PUT /api/vehicle-stats/:vehicleId
router.put('/:vehicleId', updateVehicleStats);

// DELETE /api/vehicle-stats/:vehicleId
router.delete('/:vehicleId', deleteVehicleStats);

export default router;
