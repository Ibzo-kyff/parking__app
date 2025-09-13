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
const express_1 = __importDefault(require("express"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const client_1 = require("@prisma/client");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const vehiculeRoutes_1 = __importDefault(require("./routes/vehiculeRoutes"));
const parkingRoutes_1 = __importDefault(require("./routes/parkingRoutes"));
const reservationRoute_1 = __importDefault(require("./routes/reservationRoute"));
const notificationRoute_1 = __importDefault(require("./routes/notificationRoute"));
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/vehicules', vehiculeRoutes_1.default);
app.use('/api/parkings', parkingRoutes_1.default);
app.use('/api/reservations', reservationRoute_1.default);
app.use('/api/notifications', notificationRoute_1.default);
// Middleware global d'erreurs (Multer + génériques)
app.use((err, _req, res, _next) => {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'MulterError') {
        return res.status(400).json({
            error: err.message || 'Erreur upload',
            hint: "Utilisez Body=form-data avec un champ 'image' ou 'photos' de type Fichier. Ne laissez pas le nom de champ vide."
        });
    }
    if (err instanceof Error) {
        return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Server running on port ${PORT}`);
    try {
        yield prisma.$connect();
        console.log('Connecté à PostgreSQL');
    }
    catch (err) {
        console.error('Erreur de connexion:', err);
        process.exit(1);
    }
}));
