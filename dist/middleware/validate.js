"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLogin = exports.validateRegister = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
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
