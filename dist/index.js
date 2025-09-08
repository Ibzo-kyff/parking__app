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
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const socket_io_1 = require("socket.io");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const client_1 = require("@prisma/client");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const vehiculeRoutes_1 = __importDefault(require("./routes/vehiculeRoutes"));
const parkingRoutes_1 = __importDefault(require("./routes/parkingRoutes"));
const reservationRoute_1 = __importDefault(require("./routes/reservationRoute"));
const notificationRoute_1 = __importDefault(require("./routes/notificationRoute"));
const messageRoute_1 = __importDefault(require("./routes/messageRoute"));
const http_1 = require("http");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
// Middlewares globaux
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Servir les fichiers statiques
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Routes principales
app.use('/api/auth', authRoutes_1.default);
app.use('/api/vehicules', vehiculeRoutes_1.default);
app.use('/api/parkings', parkingRoutes_1.default);
app.use('/api/reservations', reservationRoute_1.default);
app.use('/api/notifications', notificationRoute_1.default);
app.use('/api/message', messageRoute_1.default); // supprimé doublon
// Middleware global d'erreurs (Multer + génériques)
app.use((err, _req, res, _next) => {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'MulterError') {
        return res.status(400).json({
            error: err.message || 'Erreur upload',
            hint: "Utilisez Body=form-data avec un champ 'image'/'logo' ou 'file' de type Fichier."
        });
    }
    if (err instanceof Error) {
        return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
});
const PORT = process.env.PORT || 5000;
// Création serveur HTTP + Socket.IO
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*", // mettre l'URL frontend si nécessaire
        methods: ["GET", "POST"]
    }
});
exports.io = io;
// Gestion WebSocket
io.on("connection", (socket) => {
    console.log("🔌 Nouveau client connecté :", socket.id);
    socket.on("join", (userId) => {
        socket.join(`user_${userId}`);
        console.log(`👤 Utilisateur ${userId} a rejoint la room user_${userId}`);
    });
    socket.on("disconnect", () => {
        console.log(`❌ Client déconnecté : ${socket.id}`);
    });
});
// Lancement serveur
httpServer.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`🚀 Server running on port ${PORT}`);
    try {
        yield prisma.$connect();
        console.log('✅ Connecté à PostgreSQL');
    }
    catch (err) {
        console.error('❌ Erreur de connexion:', err);
        process.exit(1);
    }
}));
// Gestion arrêt propre
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('\n🔌 Fermeture du serveur...');
    yield prisma.$disconnect();
    process.exit(0);
}));
