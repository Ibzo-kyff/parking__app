"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const parkingController_1 = require("../controllers/parkingController");
const multer_1 = __importDefault(require("multer"));
const authMiddleware_1 = require("../middleware/authMiddleware");
// Supprimez 'path' si plus utilisé, ou gardez-le si besoin ailleurs
const router = express_1.default.Router();
// Config Multer en mémoire (buffer) pour Vercel
const storage = multer_1.default.memoryStorage(); // Changement ici : pas de diskStorage
const upload = (0, multer_1.default)({ storage });
router.post('/', upload.single("logo"), parkingController_1.createParking);
router.get('/', parkingController_1.getAllParkings);
router.get('/:id', parkingController_1.getParkingById);
router.get('/me', authMiddleware_1.authenticateToken, parkingController_1.getMyParking);
router.put('/:id', authMiddleware_1.authenticateToken, upload.single("logo"), parkingController_1.updateParking);
router.delete('/:id', parkingController_1.deleteParking);
exports.default = router;
