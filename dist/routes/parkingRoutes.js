"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const parkingController_1 = require("../controllers/parkingController");
const validate_1 = require("../middleware/validate");
const router = express_1.default.Router();
router.post('/', parkingController_1.createParking);
router.get('/', parkingController_1.getAllParkings);
router.get('/:id', parkingController_1.getParkingById);
router.put('/:id', parkingController_1.updateParking);
router.delete('/:id', parkingController_1.deleteParking);
router.post('/upload-logo', validate_1.upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'file', maxCount: 1 }]), (req, res) => {
    var _a, _b;
    const files = req.files;
    const file = ((_a = files === null || files === void 0 ? void 0 : files.logo) === null || _a === void 0 ? void 0 : _a[0]) || ((_b = files === null || files === void 0 ? void 0 : files.file) === null || _b === void 0 ? void 0 : _b[0]);
    if (!file) {
        return res.status(400).json({ error: "Aucun fichier envoyé. Champs acceptés: 'logo' ou 'file'" });
    }
    const logoUrl = `/uploads/${file.filename}`;
    return res.status(201).json({ message: 'Logo uploadé avec succès', logoUrl });
});
exports.default = router;
