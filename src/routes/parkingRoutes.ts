import express from 'express';
import {
  createParking,
  getAllParkings,
  getParkingById,
  updateParking,
  deleteParking
} from '../controllers/parkingController';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Config Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});
const upload = multer({ storage });

router.post('/', upload.single("logo"), createParking);
router.get('/', getAllParkings);
router.get('/:id', getParkingById);
router.put('/:id', upload.single("logo"), updateParking);
router.delete('/:id', deleteParking);

export default router;
