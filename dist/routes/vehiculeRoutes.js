"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vehiculeController_1 = require("../controllers/vehiculeController");
const authMiddleware_1 = require("../middleware/authMiddleware"); // Import du middleware d'authentification
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.join(__dirname, "../../uploads")); // Dossier uploads à la racine du projet
    },
    filename: (req, file, cb) => {
        // Génère un nom unique
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    },
});
const upload = (0, multer_1.default)({ storage });
// Routes spécifiques d'abord
router.get('/marques', vehiculeController_1.getDistinctMarques);
router.get('/models', vehiculeController_1.getDistinctModels);
router.get('/recent-parkings', vehiculeController_1.getRecentParkings);
// Nouvelle route pour les véhicules du parking utilisateur (protégée par authentification)
router.get('/parking/my-vehicles', authMiddleware_1.authenticateToken, vehiculeController_1.getParkingUserVehicles);
router.get('/parking/stats', authMiddleware_1.authenticateToken, vehiculeController_1.getParkingStats);
// Routes générales ensuite
router.post("/", upload.array("photos"), vehiculeController_1.createVehicule);
router.get('/', vehiculeController_1.getAllVehicules);
// Routes paramétrées en dernier
router.get('/parking/management', authMiddleware_1.authenticateToken, vehiculeController_1.getParkingManagementData);
router.get('/:id', vehiculeController_1.getVehiculeById);
router.get('/parking/my-vehicles/:id', authMiddleware_1.authenticateToken, vehiculeController_1.getParkingUserVehicleById);
router.put('/:id', vehiculeController_1.updateVehicule);
router.delete('/:id', vehiculeController_1.deleteVehicule);
exports.default = router;
