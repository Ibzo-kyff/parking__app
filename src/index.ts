import express from 'express';
import path from 'path';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import vehiculeRoutes from './routes/vehiculeRoutes';
import parkingRoutes from './routes/parkingRoutes';
import reservationRoutes from './routes/reservationRoute';
import notificationRoutes from './routes/notificationRoute';
import messageRoute from './routes/messageRoute';
import multer from 'multer';
import { createServer } from 'http';

const app = express();
const prisma = new PrismaClient();

// Middlewares globaux
app.use(express.json());
app.use(cookieParser());

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes principales
app.use('/api/auth', authRoutes);
app.use('/api/vehicules', vehiculeRoutes);
app.use('/api/parkings', parkingRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/message', messageRoute); // supprimé doublon

// Middleware global d'erreurs (Multer + génériques)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'MulterError') {
    return res.status(400).json({
      error: (err as any).message || 'Erreur upload',
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
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // mettre l'URL frontend si nécessaire
    methods: ["GET", "POST"]
  }
});

// Gestion WebSocket
io.on("connection", (socket) => {
  console.log("🔌 Nouveau client connecté :", socket.id);

  socket.on("join", (userId: number) => {
    socket.join(`user_${userId}`);
    console.log(`👤 Utilisateur ${userId} a rejoint la room user_${userId}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Client déconnecté : ${socket.id}`);
  });
});

// Export de l'instance io pour les autres modules
export { io };

// Lancement serveur
httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  try {
    await prisma.$connect();
    console.log('✅ Connecté à PostgreSQL');
  } catch (err) {
    console.error('❌ Erreur de connexion:', err);
    process.exit(1);
  }
});

// Gestion arrêt propre
process.on('SIGINT', async () => {
  console.log('\n🔌 Fermeture du serveur...');
  await prisma.$disconnect();
  process.exit(0);
});
