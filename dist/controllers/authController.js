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
exports.deleteUser = exports.updateCurrentUser = exports.updateUser = exports.getCurrentUser = exports.getUserById = exports.getAllUsers = exports.verifyResetOTP = exports.resetPassword = exports.forgotPassword = exports.verifyEmailWithOTP = exports.sendVerificationEmail = exports.logout = exports.refreshTokenHandler = exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwtUtils_1 = require("../utils/jwtUtils");
const nodemailer_1 = __importDefault(require("nodemailer"));
const blob_1 = require("@vercel/blob");
const prisma = new client_1.PrismaClient();
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
// Fonction pour générer un OTP à 4 chiffres
const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};
// Envoyer un OTP par email
const sendOTPEmail = (email, otp, purpose) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const subject = purpose === 'reset'
            ? 'Réinitialisation de votre mot de passe'
            : 'Vérification de votre email';
        const text = purpose === 'reset'
            ? `Votre code OTP pour réinitialiser votre mot de passe est : ${otp}. Ce code expire dans 15 minutes.`
            : `Votre code OTP pour vérifier votre email est : ${otp}. Ce code expire dans 15 minutes.`;
        const mailOptions = {
            to: email,
            subject,
            text,
            html: `<p>Votre code OTP est : <strong>${otp}</strong>. Ce code expire dans 15 minutes.</p>`,
        };
        yield transporter.sendMail(mailOptions);
    }
    catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email OTP:', error);
        throw new Error('Échec de l\'envoi de l\'email OTP');
    }
});
// Validation schemas
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    phone: zod_1.z.string().min(8).max(15),
    nom: zod_1.z.string().min(1, 'Le nom est requis'),
    prenom: zod_1.z.string().min(1, 'Le prénom est requis'),
    image: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    role: zod_1.z.nativeEnum(client_1.Role),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const verifyOTPSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalide'),
    otp: zod_1.z.string().length(4, 'Le code OTP doit avoir 4 chiffres'),
});
const resetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalide'),
    otp: zod_1.z.string().length(4, 'Le code OTP doit avoir 4 chiffres'),
    password: zod_1.z.string().min(6, 'Le mot de passe doit avoir au moins 6 caractères'),
});
const updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().min(8).max(15).optional(),
    nom: zod_1.z.string().min(1).optional(),
    prenom: zod_1.z.string().min(1).optional(),
    image: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    role: zod_1.z.nativeEnum(client_1.Role).optional(),
    status: zod_1.z.nativeEnum(client_1.Status).optional(),
    emailVerified: zod_1.z.boolean().optional(),
    password: zod_1.z.string().min(6).optional(),
});
const selfUpdateSchema = zod_1.z.object({
    phone: zod_1.z.string().min(8).max(15).optional(),
    nom: zod_1.z.string().min(1).optional(),
    prenom: zod_1.z.string().min(1).optional(),
    image: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    password: zod_1.z.string().min(6).optional(),
});
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const body = registerSchema.parse(req.body);
        const file = req.file;
        const existing = yield prisma.user.findFirst({
            where: { OR: [{ email: body.email }, { phone: body.phone }] },
        });
        if (existing) {
            if (file) {
                console.warn('Fichier uploadé mais utilisateur existe déjà, aucun fichier supprimé car memoryStorage est utilisé.');
            }
            return res.status(409).json({ message: 'Email ou téléphone déjà utilisé.' });
        }
        let imageUrl;
        if (file) {
            const newFilename = `users/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? (_a = file.originalname.match(/\.[0-9a-z]+$/i)) === null || _a === void 0 ? void 0 : _a[0] : '.jpg'}`;
            const result = yield (0, blob_1.put)(newFilename, file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            imageUrl = result.url;
        }
        const hashedPassword = yield bcrypt_1.default.hash(body.password, 10);
        const user = yield prisma.user.create({
            data: {
                email: body.email,
                password: hashedPassword,
                phone: body.phone,
                nom: body.nom,
                prenom: body.prenom,
                image: imageUrl,
                address: body.address,
                role: body.role,
                status: body.role === 'CLIENT' ? client_1.Status.APPROVED : client_1.Status.PENDING,
            },
        });
        if (!user.emailVerified) {
            const otp = generateOTP();
            const expires = new Date(Date.now() + 15 * 60 * 1000);
            yield prisma.user.update({
                where: { id: user.id },
                data: { emailVerifyOTP: otp, emailVerifyOTPExpires: expires },
            });
            yield sendOTPEmail(body.email, otp, 'verify');
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
        return res.status(201).json({
            message: 'Inscription réussie. Vérifiez votre email avec le code OTP.',
            accessToken,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified
        });
    }
    catch (err) {
        console.error('Erreur lors de l\'inscription:', err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
        const parking = user.role === 'PARKING'
            ? yield prisma.parking.findUnique({
                where: { userId: user.id },
                select: { id: true }
            })
            : null;
        return res.status(200).json({
            message: 'Connexion réussie',
            accessToken,
            role: user.role,
            emailVerified: user.emailVerified,
            nom: user.nom,
            prenom: user.prenom,
            id: user.id,
            parkingId: (_a = parking === null || parking === void 0 ? void 0 : parking.id) !== null && _a !== void 0 ? _a : null
        });
    }
    catch (err) {
        console.error('Erreur lors de la connexion:', err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.login = login;
const refreshTokenHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token manquant' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = yield prisma.user.findUnique({
            where: { id: decoded.id, refreshToken },
        });
        if (!user || user.status === client_1.Status.PENDING) {
            return res.status(403).json({ message: 'Refresh token invalide ou compte en attente' });
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
        console.error('Erreur lors du rafraîchissement du token:', err);
        return res.status(403).json({ message: 'Refresh token invalide' });
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
        console.error('Erreur lors de la déconnexion:', err);
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.logout = logout;
const sendVerificationEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: 'Non authentifié' });
    try {
        const otp = generateOTP();
        const expires = new Date(Date.now() + 15 * 60 * 1000);
        yield prisma.user.update({
            where: { id: req.user.id },
            data: {
                emailVerifyOTP: otp,
                emailVerifyOTPExpires: expires,
                verificationToken: null,
                verificationTokenExpires: null,
            },
        });
        yield sendOTPEmail(req.user.email, otp, 'verify');
        res.json({
            message: 'Code OTP de vérification envoyé',
            otp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
    }
    catch (err) {
        console.error('Erreur lors de l\'envoi de l\'OTP:', err);
        return res.status(500).json({ message: 'Erreur lors de l\'envoi du code OTP', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.sendVerificationEmail = sendVerificationEmail;
const verifyEmailWithOTP = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, otp } = verifyOTPSchema.parse(req.body);
        const user = yield prisma.user.findFirst({
            where: {
                email,
                emailVerifyOTP: otp,
                emailVerifyOTPExpires: { gt: new Date() },
            },
        });
        if (!user) {
            return res.status(400).json({ message: 'Code OTP invalide ou expiré' });
        }
        yield prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                emailVerifyOTP: null,
                emailVerifyOTPExpires: null,
                verificationToken: null,
                verificationTokenExpires: null,
            },
        });
        res.json({ message: 'Email vérifié avec succès' });
    }
    catch (err) {
        console.error('Erreur lors de la vérification de l\'email:', err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.verifyEmailWithOTP = verifyEmailWithOTP;
const forgotPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        const user = yield prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.json({ message: 'Si cet email existe, un code OTP a été envoyé' });
        }
        const otp = generateOTP();
        const expires = new Date(Date.now() + 15 * 60 * 1000);
        yield prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetOTP: otp,
                passwordResetOTPExpires: expires,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });
        yield sendOTPEmail(user.email, otp, 'reset');
        res.json({
            message: 'Code OTP envoyé par email',
            otp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
    }
    catch (err) {
        console.error('Erreur lors de la demande de réinitialisation:', err);
        return res.status(500).json({ message: 'Erreur lors de l\'envoi du code OTP', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.forgotPassword = forgotPassword;
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, otp, password } = resetPasswordSchema.parse(req.body);
        const user = yield prisma.user.findFirst({
            where: {
                email,
                passwordResetOTP: otp,
                passwordResetOTPExpires: { gt: new Date() },
            },
        });
        if (!user) {
            return res.status(400).json({ message: 'Code OTP invalide ou expiré' });
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        yield prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetOTP: null,
                passwordResetOTPExpires: null,
                passwordResetToken: null,
                passwordResetExpires: null,
                refreshToken: null,
            },
        });
        res.json({ message: 'Mot de passe réinitialisé avec succès' });
    }
    catch (err) {
        console.error('Erreur lors de la réinitialisation du mot de passe:', err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.resetPassword = resetPassword;
const verifyResetOTP = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, otp } = verifyOTPSchema.parse(req.body);
        const user = yield prisma.user.findFirst({
            where: {
                email,
                passwordResetOTP: otp,
                passwordResetOTPExpires: { gt: new Date() },
            },
        });
        if (!user) {
            return res.status(400).json({ message: 'Code OTP invalide ou expiré' });
        }
        return res.json({
            message: 'Code OTP validé',
            verified: true
        });
    }
    catch (err) {
        console.error('Erreur lors de la vérification de l\'OTP:', err);
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.verifyResetOTP = verifyResetOTP;
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
        console.error('Erreur lors de la récupération des utilisateurs:', err);
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
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
        console.error('Erreur lors de la récupération de l\'utilisateur:', err);
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.getUserById = getUserById;
const getCurrentUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Non authentifié' });
        }
        const user = yield prisma.user.findUnique({
            where: { id: req.user.id },
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
        const authHeader = req.headers.authorization;
        const accessToken = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.split(' ')[1]
            : null;
        return res.status(200).json(Object.assign(Object.assign({}, user), { accessToken }));
    }
    catch (err) {
        console.error('Erreur lors de la récupération de l\'utilisateur courant:', err);
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.getCurrentUser = getCurrentUser;
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.id !== userId)) {
            return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs ou le propriétaire peuvent modifier cet utilisateur.' });
        }
        const file = req.file;
        const body = updateUserSchema.parse(req.body);
        if (req.user.role !== 'ADMIN' && (body.role || body.status)) {
            return res.status(403).json({ message: 'Seuls les administrateurs peuvent modifier le rôle ou le statut.' });
        }
        const existingUser = yield prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
        if (!existingUser) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        let imageUrl = existingUser.image;
        if (file) {
            if (imageUrl) {
                try {
                    const url = new URL(imageUrl);
                    yield (0, blob_1.del)(url.pathname.slice(1));
                }
                catch (error) {
                    console.warn(`Ancien blob non supprimé, URL invalide : ${imageUrl}`);
                }
            }
            const newFilename = `users/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? (_a = file.originalname.match(/\.[0-9a-z]+$/i)) === null || _a === void 0 ? void 0 : _a[0] : '.jpg'}`;
            const result = yield (0, blob_1.put)(newFilename, file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            imageUrl = result.url;
        }
        const hashedPassword = body.password ? yield bcrypt_1.default.hash(body.password, 10) : undefined;
        const updatedUser = yield prisma.user.update({
            where: { id: userId },
            data: {
                email: body.email,
                phone: body.phone,
                nom: body.nom,
                prenom: body.prenom,
                image: imageUrl,
                address: body.address,
                role: body.role,
                status: body.status,
                emailVerified: body.emailVerified,
                password: hashedPassword,
            },
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
        return res.status(200).json({ message: 'Utilisateur mis à jour avec succès', user: updatedUser });
    }
    catch (err) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur:', err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        else if (err instanceof Error && 'code' in err && err.code === 'P2025') {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.updateUser = updateUser;
const updateCurrentUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Non authentifié' });
        }
        const file = req.file;
        const body = selfUpdateSchema.parse(req.body);
        console.log('File received:', file ? {
            originalname: file.originalname,
            size: file.size,
            bufferLength: (_a = file.buffer) === null || _a === void 0 ? void 0 : _a.length,
            mimetype: file.mimetype
        } : 'No file');
        const existingUser = yield prisma.user.findUnique({
            where: { id: req.user.id },
            select: { image: true }
        });
        if (!existingUser) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        let imageUrl = existingUser.image;
        if (file && file.buffer && file.buffer.length > 0) {
            console.log('Uploading file to Vercel Blob...');
            if (imageUrl) {
                try {
                    const url = new URL(imageUrl);
                    yield (0, blob_1.del)(url.pathname.slice(1));
                    console.log('Old blob deleted successfully');
                }
                catch (error) {
                    console.warn(`Ancien blob non supprimé, URL invalide : ${imageUrl}`);
                }
            }
            const fileExtension = file.originalname ?
                ((_b = file.originalname.match(/\.[0-9a-z]+$/i)) === null || _b === void 0 ? void 0 : _b[0]) || '.jpg' :
                '.jpg';
            const newFilename = `users/${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`;
            try {
                const result = yield (0, blob_1.put)(newFilename, file.buffer, {
                    access: 'public',
                    token: process.env.BLOB_READ_WRITE_TOKEN,
                });
                imageUrl = result.url;
                console.log('File uploaded to Vercel Blob:', imageUrl);
            }
            catch (blobError) {
                console.error('Vercel Blob upload error:', blobError);
                return res.status(500).json({
                    message: 'Erreur lors de l\'upload de l\'image',
                    details: 'Échec de l\'upload Vercel Blob'
                });
            }
        }
        else if (file) {
            console.warn('Fichier reçu mais buffer vide, ignoré');
        }
        const hashedPassword = body.password ? yield bcrypt_1.default.hash(body.password, 10) : undefined;
        const updatedUser = yield prisma.user.update({
            where: { id: req.user.id },
            data: {
                phone: body.phone,
                nom: body.nom,
                prenom: body.prenom,
                image: imageUrl,
                address: body.address,
                password: hashedPassword,
            },
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
        return res.status(200).json({ message: 'Profil mis à jour avec succès', user: updatedUser });
    }
    catch (err) {
        console.error('Erreur lors de la mise à jour du profil:', err);
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Données invalides', errors: err.issues });
        }
        else if (err instanceof Error && 'code' in err && err.code === 'P2025') {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.updateCurrentUser = updateCurrentUser;
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.id !== userId)) {
            return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs ou le propriétaire peuvent supprimer cet utilisateur.' });
        }
        const user = yield prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        if (user.image) {
            try {
                const url = new URL(user.image);
                yield (0, blob_1.del)(url.pathname.slice(1));
            }
            catch (error) {
                console.warn(`Ancien blob non supprimé, URL invalide : ${user.image}`);
            }
        }
        yield prisma.user.delete({
            where: { id: userId },
        });
        return res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
    }
    catch (err) {
        console.error('Erreur lors de la suppression de l\'utilisateur:', err);
        if (err instanceof Error && 'code' in err && err.code === 'P2025') {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        return res.status(500).json({ message: 'Erreur serveur', details: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
});
exports.deleteUser = deleteUser;
