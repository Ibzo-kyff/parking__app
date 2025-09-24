import { Router } from 'express';
import multer from 'multer';
import {
  createMarque,
  getAllMarques,
  getMarqueById,
  updateMarque,
  deleteMarque,
} from '../controllers/marqueController';

const router = Router();
const upload = multer();

router.post('/', upload.single('logo'), createMarque);
router.get('/', getAllMarques);
router.get('/:id', getMarqueById);
router.put('/:id', upload.single('logo'), updateMarque);
router.delete('/:id', deleteMarque);

export default router;
