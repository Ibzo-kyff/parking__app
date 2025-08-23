"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vehiculeController_1 = require("../controllers/vehiculeController");
const validate_1 = require("../middleware/validate");
const authMiddleware_1 = require("../middleware/authMiddleware"); // Import du middleware d'authentification
const router = (0, express_1.Router)();
// Routes spécifiques d'abord
router.get('/marques', vehiculeController_1.getDistinctMarques);
router.get('/models', vehiculeController_1.getDistinctModels);
router.get('/recent-parkings', vehiculeController_1.getRecentParkings);
// Nouvelle route pour les véhicules du parking utilisateur (protégée par authentification)
router.get('/parking/my-vehicles', authMiddleware_1.authenticateToken, vehiculeController_1.getParkingUserVehicles);
router.get('/parking/stats', authMiddleware_1.authenticateToken, vehiculeController_1.getParkingStats);
// Routes générales ensuite
router.post('/', vehiculeController_1.createVehicule);
router.get('/', vehiculeController_1.getAllVehicules);
router.post('/upload-image', validate_1.upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier envoyé.' });
    }
    const imageUrl = `/public/${req.file.filename}`;
    return res.status(201).json({ message: 'Image uploadée avec succès', imageUrl });
});
// Routes paramétrées en dernier
router.get('/:id', vehiculeController_1.getVehiculeById);
router.put('/:id', vehiculeController_1.updateVehicule);
router.delete('/:id', vehiculeController_1.deleteVehicule);
exports.default = router;
