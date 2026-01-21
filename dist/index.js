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
exports.pusher = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const client_1 = require("@prisma/client");
const pusher_1 = __importDefault(require("pusher"));
// Routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const vehiculeRoutes_1 = __importDefault(require("./routes/vehiculeRoutes"));
const parkingRoutes_1 = __importDefault(require("./routes/parkingRoutes"));
const reservationRoute_1 = __importDefault(require("./routes/reservationRoute"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const marqueRoutes_1 = __importDefault(require("./routes/marqueRoutes"));
const messageRoutes_1 = __importDefault(require("./routes/messageRoutes"));
const pusher_2 = __importDefault(require("./routes/pusher"));
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const allowedOrigins = [
    "http://localhost:3000",
    "https://localhost:3000",
    "https://mobility-mali.netlify.app",
];
const corsOptions = {
    origin: (origin, callback) => {
        // Autorise SSR / Postman / Server-to-server
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // ⚠️ Ne JAMAIS lever d’erreur ici
        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use((0, cors_1.default)(corsOptions));
app.options("*", (0, cors_1.default)(corsOptions)); // 🔴 OBLIGATOIRE pour le preflight
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
exports.pusher = new pusher_1.default({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
});
app.use("/api/auth", authRoutes_1.default);
app.use("/api/vehicules", vehiculeRoutes_1.default);
app.use("/api/parkings", parkingRoutes_1.default);
app.use("/api/reservations", reservationRoute_1.default);
app.use("/api/notifications", notificationRoutes_1.default);
app.use("/api/marques", marqueRoutes_1.default);
app.use("/api/messages", messageRoutes_1.default);
app.use("/api", pusher_2.default);
app.use((err, _req, res, _next) => {
    if (err &&
        typeof err === "object" &&
        "name" in err &&
        err.name === "MulterError") {
        return res.status(400).json({
            error: err.message || "Erreur upload",
            hint: "Utilisez form-data avec un champ 'image' ou 'photos' de type fichier.",
        });
    }
    if (err instanceof Error) {
        return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: "Erreur serveur" });
});
if (process.env.NODE_ENV !== "production") {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
        console.log(`✅ Server running on port ${PORT}`);
        try {
            yield prisma.$connect();
            console.log("✅ Connecté à PostgreSQL");
        }
        catch (err) {
            console.error("❌ Erreur PostgreSQL :", err);
        }
    }));
}
exports.default = app;
