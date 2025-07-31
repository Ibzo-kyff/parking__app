import express from 'express';
import {
  createParking,
  getAllParkings,
  getParkingById,
  updateParking,
  deleteParking
} from '../controllers/parking.controller';

const router = express.Router();

router.post('/', createParking);
router.get('/', getAllParkings);
router.get('/:id', getParkingById);
router.put('/:id', updateParking);
router.delete('/:id', deleteParking);

export default router;
