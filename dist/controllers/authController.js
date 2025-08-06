"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUserById = exports.getAllUsers = exports.resetPassword = exports.forgotPassword = exports.verifyEmail = exports.sendVerificationEmail = exports.logout = exports.refreshTokenHandler = exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwtUtils_1 = require("../utils/jwtUtils");
const crypto_1 = __importDefault(require("crypto"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma = new client_1.PrismaClient();
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
// Validation du corps de la requête
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    phone: zod_1.z.string().min(8).max(15),
    nom: zod_1.z.string().min(1, 'Le nom est requis'),
    prenom: zod_1.z.string().min(1, 'Le prénom est requis'),
    image: zod_1.z.string().url().optional(), // Optionnel, mais doit être une URL valide si fourni
    address: zod_1.z.string().optional(), // Optionnel
    role: zod_1.z.nativeEnum(client_1.Role),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().min(8).max(15).optional(),
    nom: zod_1.z.string().min(1).optional(),
    prenom: zod_1.z.string().min(1).optional(),
    image: zod_1.z.string().url().optional(),
    address: zod_1.z.string().optional(),
    role: zod_1.z.nativeEnum(client_1.Role).optional(),
    status: zod_1.z.nativeEnum(client_1.Status).optional(),
    emailVerified: zod_1.z.boolean().optional(),
    password: zod_1.z.string().min(6).optional(),
});
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = registerSchema.parse(req.body);
        const existing = yield prisma.user.findFirst({
            where: { OR: [{ email: data.email }, { phone: data.phone }] },
        });
        if (existing) {
            return res.status(409).json({ message: 'Email ou téléphone déjà utilisé.' });
        }
        const hashedPassword = yield bcrypt_1.default.hash(data.password, 10);
        const user = yield prisma.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                phone: data.phone,
                nom: data.nom,
                prenom: data.prenom,
                image: data.image,
                address: data.address,
                role: data.role,
                status: data.role === 'CLIENT' ? client_1.Status.APPROVED : client_1.Status.PENDING,
            },
        });
        if (!user.emailVerified) {
            const verificationToken = crypto_1.default.randomBytes(32).toString('hex');
            const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
            yield prisma.user.update({
                where: { id: user.id },
                data: { verificationToken, verificationTokenExpires },
            });
            const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
            const mailOptions = {
                to: data.email,
                subject: 'Vérification de votre email',
                html: `Cliquez <a href="${verificationUrl}">ici</a> pour vérifier votre email. Ce lien expire dans 24 heures.`,
            };
            yield transporter.sendMail(mailOptions);
        }
        const accessToken = (0, jwtUtils_1.generateAccessToken)({ id: user.id, email: user.email, role: user.role });
        const refreshToken = (0, jwtUtils_1.generateRefreshToken)({ id: user.id, email: user.email, role: user.role });
        yield prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.status(201).json({ message: 'Inscription réussie', accessToken });
    }
    catch (err) {
        console.error(err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        else if (err instanceof Error && err.name === 'SendMailError') {
            return res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email de vérification' });
        }
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = loginSchema.parse(req.body);
        const user = yield prisma.user.findUnique({
            where: { email: data.email },
        });
        if (!user || !(yield bcrypt_1.default.compare(data.password, user.password))) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }
        if (user.status === client_1.Status.PENDING) {
            return res.status(403).json({ message: 'Compte en attente d\'approbation.' });
        }
        const accessToken = (0, jwtUtils_1.generateAccessToken)({ id: user.id, email: user.email, role: user.role });
        const refreshToken = (0, jwtUtils_1.generateRefreshToken)({ id: user.id, email: user.email, role: user.role });
        yield prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.status(200).json({ message: 'Connexion réussie', accessToken });
    }
    catch (err) {
        console.error(err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.login = login;
const refreshTokenHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = yield prisma.user.findUnique({
            where: { id: decoded.id, refreshToken },
        });
        if (!user || user.status === client_1.Status.PENDING) {
            return res.status(403).json({ message: 'Invalid refresh token or account pending' });
        }
        const newAccessToken = (0, jwtUtils_1.generateAccessToken)({ id: user.id, email: user.email, role: user.role });
        const newRefreshToken = (0, jwtUtils_1.generateRefreshToken)({ id: user.id, email: user.email, role: user.role });
        yield prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.json({ accessToken: newAccessToken });
    }
    catch (err) {
        return res.status(403).json({ message: 'Invalid refresh token' });
    }
});
exports.refreshTokenHandler = refreshTokenHandler;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            const user = yield prisma.user.findFirst({ where: { refreshToken } });
            if (user) {
                yield prisma.user.update({
                    where: { id: user.id },
                    data: { refreshToken: null },
                });
            }
        }
        res.clearCookie('refreshToken');
        return res.status(200).json({ message: 'Déconnexion réussie' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.logout = logout;
const sendVerificationEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).send();
    try {
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        yield prisma.user.update({
            where: { id: req.user.id },
            data: {
                verificationToken: token,
                verificationTokenExpires: expires,
            },
        });
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
        const mailOptions = {
            to: req.user.email,
            subject: 'Vérification de votre email',
            html: `Cliquez <a href="${verificationUrl}">ici</a> pour vérifier votre email.`,
        };
        yield transporter.sendMail(mailOptions);
        res.json({ message: 'Email de vérification envoyé' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email de vérification' });
    }
});
exports.sendVerificationEmail = sendVerificationEmail;
const verifyEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token } = req.params;
        const user = yield prisma.user.findFirst({
            where: {
                verificationToken: token,
                verificationTokenExpires: { gt: new Date() },
            },
        });
        if (!user) {
            return res.status(400).json({ message: 'Token invalide ou expiré' });
        }
        yield prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                verificationToken: null,
                verificationTokenExpires: null,
            },
        });
        res.json({ message: 'Email vérifié avec succès' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.verifyEmail = verifyEmail;
const forgotPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        const user = yield prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
        }
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000);
        yield prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: token,
                passwordResetExpires: expires,
            },
        });
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
        const mailOptions = {
            to: user.email,
            subject: 'Réinitialisation de votre mot de passe',
            html: `Cliquez <a href="${resetUrl}">ici</a> pour réinitialiser votre mot de passe.`,
        };
        yield transporter.sendMail(mailOptions);
        res.json({ message: 'Lien de réinitialisation envoyé' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur lors de l\'envoi du lien de réinitialisation' });
    }
});
exports.forgotPassword = forgotPassword;
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token } = req.params;
        const { password } = req.body;
        const user = yield prisma.user.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpires: { gt: new Date() },
            },
        });
        if (!user) {
            return res.status(400).json({ message: 'Token invalide ou expiré' });
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        yield prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
                refreshToken: null,
            },
        });
        res.json({ message: 'Mot de passe réinitialisé avec succès' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.resetPassword = resetPassword;
// Nouvelles méthodes pour gérer les utilisateurs
const getAllUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent voir tous les utilisateurs.' });
        }
        const users = yield prisma.user.findMany({
            select: {
                id: true,
                email: true,
                phone: true,
                nom: true,
                prenom: true,
                image: true,
                address: true,
                role: true,
                status: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return res.status(200).json(users);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.getAllUsers = getAllUsers;
const getUserById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.id !== userId)) {
            return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs ou le propriétaire peuvent voir cet utilisateur.' });
        }
        const user = yield prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone: true,
                nom: true,
                prenom: true,
                image: true,
                address: true,
                role: true,
                status: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        return res.status(200).json(user);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.getUserById = getUserById;
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.id !== userId)) {
            return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs ou le propriétaire peuvent modifier cet utilisateur.' });
        }
        const data = updateUserSchema.parse(req.body);
        // Restreindre la modification de role et status aux admins
        if (req.user.role !== 'ADMIN' && (data.role || data.status)) {
            return res.status(403).json({ message: 'Seuls les administrateurs peuvent modifier le rôle ou le statut.' });
        }
        const hashedPassword = data.password ? yield bcrypt_1.default.hash(data.password, 10) : undefined;
        const updatedUser = yield prisma.user.update({
            where: { id: userId },
            data: {
                email: data.email,
                phone: data.phone,
                nom: data.nom,
                prenom: data.prenom,
                image: data.image,
                address: data.address,
                role: data.role,
                status: data.status,
                emailVerified: data.emailVerified,
                password: hashedPassword,
            },
        });
        return res.status(200).json({ message: 'Utilisateur mis à jour avec succès', user: updatedUser });
    }
    catch (err) {
        console.error(err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        else if (err instanceof Error && 'code' in err && err.code === 'P2025') {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.updateUser = updateUser;
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }
        // Autoriser la suppression par l'utilisateur lui-même ou un ADMIN
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.id !== userId)) {
            return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs ou le propriétaire peuvent supprimer cet utilisateur.' });
        }
        yield prisma.user.delete({
            where: { id: userId },
        });
        return res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
    }
    catch (err) {
        console.error(err);
        if (err instanceof Error && 'code' in err && err.code === 'P2025') {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});
exports.deleteUser = deleteUser;
