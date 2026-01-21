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

const app = express();
const prisma = new PrismaClient();

const allowedOrigins = [
  "http://localhost:3000",
  "https://mobility-mali.netlify.app",
];

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("/*", cors(corsOptions));

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

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === "object" && "name" in err && (err as any).name === "MulterError") {
    return res.status(400).json({
      error: (err as any).message || "Erreur upload",
      hint: "Utilisez form-data avec un champ fichier valide",
    });
  }

  if (err instanceof Error) {
    return res.status(500).json({ error: err.message });
  }

  return res.status(500).json({ error: "Erreur serveur" });
});

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await prisma.$connect();
  });
}

export default app;
