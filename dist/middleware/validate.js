"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = exports.validateLogin = exports.validateRegister = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8, { message: 'Le mot de passe doit avoir au moins 8 caractères' })
        .regex(/[A-Z]/, { message: 'Le mot de passe doit contenir une majuscule' })
        .regex(/[0-9]/, { message: 'Le mot de passe doit contenir un chiffre' }),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.nativeEnum(client_1.Role),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const validateRegister = (req, res, next) => {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ errors: result.error.issues });
    }
    next();
};
exports.validateRegister = validateRegister;
const validateLogin = (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ errors: result.error.issues });
    }
    next();
};
exports.validateLogin = validateLogin;
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path_1.default.join(__dirname, '../../uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});
exports.upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Seules les images sont autorisées !'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});
