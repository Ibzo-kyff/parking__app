import express from "express";
import authRoutes from "./routes/authRoutes";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import cookieParser from "cookie-parser";
import vehiculeRoutes from "./routes/vehiculeRoutes";
import parkingRoutes from "./routes/parkingRoutes";
import reservationRoutes from "./routes/reservationRoute";
import notificationRoutes from "./routes/notificationRoutes";
import marqueRoutes from "./routes/marqueRoutes";
import messageRoutes from "./routes/messageRoutes";
import Pusher from "pusher";
import pusherRoutes from "./routes/pusher";
import adminRouter from './routes/adminRoutes';

const app = express();
const prisma = new PrismaClient();

const allowedOrigins = [
    "https://mobility-mali.com",
    "https://www.mobility-mali.com",
    "https://mobility-mali.netlify.app",
    "http://localhost:3000",
    "http://localhost:5173"
];

app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Autoriser les requêtes sans origine (Postman, applications mobiles, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error("Bloqué par la politique CORS (Non autorisé par Vercel/Express)"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["X-CSRF-Token", "X-Requested-With", "Accept", "Accept-Version", "Content-Length", "Content-MD5", "Content-Type", "Date", "X-Api-Version", "Authorization"]
}));

// Gestion explicite des requêtes preflight OPTIONS
app.options('*', cors());

app.use(express.json());
app.use(cookieParser());

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

app.use("/api/auth", authRoutes);
app.use("/api/vehicules", vehiculeRoutes);
app.use("/api/parkings", parkingRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/marques", marqueRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api", pusherRoutes);
app.use('/api/admin', adminRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  return res.status(500).json({ error: err.message || "Erreur serveur" });
});

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await prisma.$connect();
  });
}

export default app;