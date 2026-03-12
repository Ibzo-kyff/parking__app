"use strict";
// parkingRouter.ts (VERSION CORRIGÉE)
// Ajout du middleware authenticateToken sur POST et DELETE (manquant avant !)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const parkingController_1 = require("../controllers/parkingController");
const multer_1 = __importDefault(require("multer"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
// ROUTES AVEC AUTHENTIFICATION OBLIGATOIRE
router.post('/', authMiddleware_1.authenticateToken, upload.single("logo"), parkingController_1.createParking);
router.get('/', parkingController_1.getAllParkings);
router.get('/me', authMiddleware_1.authenticateToken, parkingController_1.getMyParking);
router.get('/:id', parkingController_1.getParkingById);
router.put('/:id', authMiddleware_1.authenticateToken, upload.single("logo"), parkingController_1.updateParking);
router.delete('/:id', authMiddleware_1.authenticateToken, parkingController_1.deleteParking); // ← AJOUTÉ !
exports.default = router;
