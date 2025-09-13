import { Router } from 'express';
import {
  createVehicule,
  getAllVehicules,
  getVehiculeById,
  updateVehicule,
  deleteVehicule,
  getDistinctMarques,
  getDistinctModels,
  getRecentParkings,
  getParkingStats,
  getParkingUserVehicles,
  getParkingUserVehicleById,
  getParkingManagementData
} from '../controllers/vehiculeController';
import { authenticateToken } from '../middleware/authMiddleware';
import multer from 'multer';

const router = Router();

// Config Multer en mémoire (buffer) pour Vercel
const storage = multer.memoryStorage(); // Changement ici : pas de diskStorage
const upload = multer({ storage });

// Routes spécifiques d'abord
router.get('/marques', getDistinctMarques);
router.get('/models', getDistinctModels);
router.get('/recent-parkings', getRecentParkings);

// Nouvelle route pour les véhicules du parking utilisateur (protégée par authentification)
router.get('/parking/my-vehicles', authenticateToken, getParkingUserVehicles);
router.get('/parking/stats', authenticateToken, getParkingStats);

// Routes générales ensuite
router.post('/', upload.array('photos'), createVehicule);
router.get('/', getAllVehicules);

// Routes paramétrées en dernier
router.get('/parking/management', authenticateToken, getParkingManagementData);
router.get('/:id', getVehiculeById);
router.get('/parking/my-vehicles/:id', authenticateToken, getParkingUserVehicleById);
router.put('/:id', upload.array('photos'), updateVehicule);
router.delete('/:id', deleteVehicule);

export default router;