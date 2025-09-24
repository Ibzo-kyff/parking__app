"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const marqueController_1 = require("../controllers/marqueController");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)();
router.post('/', upload.single('logo'), marqueController_1.createMarque);
router.get('/', marqueController_1.getAllMarques);
router.get('/:id', marqueController_1.getMarqueById);
router.put('/:id', upload.single('logo'), marqueController_1.updateMarque);
router.delete('/:id', marqueController_1.deleteMarque);
exports.default = router;
