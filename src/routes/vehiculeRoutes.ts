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
  getParkingUserVehicles, // Ajouter cette importation
  getParkingUserVehicleById,
  getParkingManagementData
} from '../controllers/vehiculeController';
import { authenticateToken } from '../middleware/authMiddleware'; // Import du middleware d'authentification
import multer from 'multer';
import path from 'path';

const router = Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads")); // Dossier uploads à la racine du projet
  },
  filename: (req, file, cb) => {
    // Génère un nom unique
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

// Routes spécifiques d'abord
router.get('/marques', getDistinctMarques);
router.get('/models', getDistinctModels);
router.get('/recent-parkings', getRecentParkings);

// Nouvelle route pour les véhicules du parking utilisateur (protégée par authentification)
router.get('/parking/my-vehicles', authenticateToken, getParkingUserVehicles);
router.get('/parking/stats', authenticateToken, getParkingStats);

// Routes générales ensuite
router.post("/", upload.array("photos"), createVehicule);
router.get('/', getAllVehicules);

// Routes paramétrées en dernier
router.get('/parking/management', authenticateToken, getParkingManagementData);
router.get('/:id', getVehiculeById);
router.get('/parking/my-vehicles/:id', authenticateToken, getParkingUserVehicleById);
router.put('/:id', updateVehicule);
router.delete('/:id', deleteVehicule);

export default router;