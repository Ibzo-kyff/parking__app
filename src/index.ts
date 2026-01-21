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

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://mobility-mali.netlify.app",
    ],
    credentials: true,
  })
);

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
