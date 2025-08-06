"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const parkingController_1 = require("../controllers/parkingController");
const router = express_1.default.Router();
router.post('/', parkingController_1.createParking);
router.get('/', parkingController_1.getAllParkings);
router.get('/:id', parkingController_1.getParkingById);
router.put('/:id', parkingController_1.updateParking);
router.delete('/:id', parkingController_1.deleteParking);
exports.default = router;
