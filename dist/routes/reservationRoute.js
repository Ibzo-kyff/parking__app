"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const reservationController_1 = require("../controllers/reservationController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Routes protégées
router.use(authMiddleware_1.authenticateToken);
router.post('/', reservationController_1.createReservation);
router.get('/', reservationController_1.getUserReservations);
router.get('/:id', reservationController_1.getReservation);
router.delete('/:id', reservationController_1.cancelReservation);
// --- PARKING ---
router.get('/parking/all', reservationController_1.getAllReservationsForParking);
// Routes admin seulement
router.get('/admin/all', reservationController_1.getAllReservations);
router.put('/admin/:id', reservationController_1.updateReservation);
exports.default = router;
