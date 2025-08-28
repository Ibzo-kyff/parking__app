"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const parkingController_1 = require("../controllers/parkingController");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
// Config Multer
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.join(__dirname, "../../uploads"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    },
});
const upload = (0, multer_1.default)({ storage });
router.post('/', upload.single("logo"), parkingController_1.createParking);
router.get('/', parkingController_1.getAllParkings);
router.get('/:id', parkingController_1.getParkingById);
router.put('/:id', upload.single("logo"), parkingController_1.updateParking);
router.delete('/:id', parkingController_1.deleteParking);
exports.default = router;
