import express from 'express';
import authRoutes from './routes/authRoutes';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import vehiculeRoutes from './routes/vehiculeRoutes';
import parkingRoutes from './routes/parkingRoutes';
import reservationRoutes from './routes/reservationRoute';
import notificationRoutes from './routes/notificationRoute';
import marqueRoutes from './routes/marqueRoutes';
import messageRoutes from './routes/messageRoutes';

const app = express();
const httpServer = createServer(app);
// ⚡ Initialisation de Socket.IO
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});
const prisma = new PrismaClient();
// Middleware pour rendre io accessible dans les routes
app.use((req, res, next) => {
  (req as any).io = io;
  next();
});

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicules', vehiculeRoutes);
app.use('/api/parkings', parkingRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/marques', marqueRoutes);
app.use('/api/messages', messageRoutes);
// Configuration Socket.IO
io.on('connection', (socket) => {
  console.log('Utilisateur connecté:', socket.id);

  // Rejoindre une room utilisateur
  socket.on('joinUserRoom', (userId: number) => {
    socket.join(`user_${userId}`);
    console.log(`Utilisateur ${userId} a rejoint sa room`);
  });

  // Quitter une room utilisateur
  socket.on('leaveUserRoom', (userId: number) => {
    socket.leave(`user_${userId}`);
    console.log(`Utilisateur ${userId} a quitté sa room`);
  });

  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté:', socket.id);
  });
});

// Middleware global d'erreurs (Multer + génériques)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'MulterError') {
    return res.status(400).json({
      error: (err as any).message || 'Erreur upload',
      hint: "Utilisez Body=form-data avec un champ 'image' ou 'photos' de type Fichier. Ne laissez pas le nom de champ vide."
    });
  }
  if (err instanceof Error) {
    return res.status(500).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await prisma.$connect();
    console.log('Connecté à PostgreSQL');
  } catch (err) {
    console.error('Erreur de connexion:', err);
    process.exit(1);
  }
});