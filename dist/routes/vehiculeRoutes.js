"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vehiculeController_1 = require("../controllers/vehiculeController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
router.post('/', vehiculeController_1.createVehicule);
router.get('/', vehiculeController_1.getAllVehicules);
router.get('/:id', vehiculeController_1.getVehiculeById);
router.put('/:id', vehiculeController_1.updateVehicule);
router.delete('/:id', vehiculeController_1.deleteVehicule);
router.post('/upload-image', validate_1.upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier envoyé.' });
    }
    // Génère l'URL d'accès public
    const imageUrl = `/public/${req.file.filename}`;
    return res.status(201).json({ message: 'Image uploadée avec succès', imageUrl });
});
exports.default = router;
