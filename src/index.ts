// import express from 'express';
// import path from 'path';
// import authRoutes from './routes/authRoutes';
// import { PrismaClient } from '@prisma/client';
// import cookieParser from 'cookie-parser';
// import vehiculeRoutes from './routes/vehiculeRoutes';
// import parkingRoutes from './routes/parkingRoutes';
// import reservationRoutes from './routes/reservationRoute';
// import notificationRoutes from './routes/notificationRoute';
// import messageRoute from './routes/messageRoute';
// import multer from 'multer';
// const app = express();
// const prisma = new PrismaClient();

// app.use(express.json());
// app.use(cookieParser());

// // Ajout pour servir les dossiers statiques
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// app.use('/api/auth', authRoutes);
// app.use('/api/vehicules', vehiculeRoutes);
// app.use('/api/parkings', parkingRoutes);
// app.use('/api/reservations', reservationRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/message', messageRoute);
// // Middleware global d'erreurs (Multer + génériques)
// app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
//   if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'MulterError') {
//     return res.status(400).json({
//       error: (err as any).message || 'Erreur upload',
//       hint: "Utilisez Body=form-data avec un champ 'image'/'logo' ou 'file' de type Fichier. Ne laissez pas le nom de champ vide."
//     });
//   }
//   if (err instanceof Error) {
//     return res.status(500).json({ error: err.message });
//   }
//   return res.status(500).json({ error: 'Erreur serveur' });
// });

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, async () => {
//   console.log(`Server running on port ${PORT}`);
//   try {
//     await prisma.$connect();
//     console.log('Connecté à PostgreSQL');
//   } catch (err) {
//     console.error('Erreur de connexion:', err);
//     process.exit(1);
//   }
// });


import express from 'express';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Routes
import authRoutes from './routes/authRoutes';
import vehiculeRoutes from './routes/vehiculeRoutes';
import parkingRoutes from './routes/parkingRoutes';
import reservationRoutes from './routes/reservationRoute';
import notificationRoutes from './routes/notificationRoute';
import messageRoute from './routes/messageRoute';

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(express.json());
app.use(cookieParser());

// Static
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicules', vehiculeRoutes);
app.use('/api/parkings', parkingRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/message', messageRoute);

// Gestion erreurs (Multer + génériques)
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

// ⚡ Création serveur HTTP + Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // ou frontend url
    methods: ["GET", "POST"]
  }
});

// Gestion WebSocket
io.on("connection", (socket) => {
  console.log("🔌 Nouveau client connecté :", socket.id);

  // Joindre une "room" basée sur l'id user
  socket.on("join", (userId: number) => {
    socket.join(`user_${userId}`);
    console.log(`👤 Utilisateur ${userId} a rejoint la room user_${userId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client déconnecté :", socket.id);
  });
});

// Export pour controllers (messageController)
export { io };

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  try {
    await prisma.$connect();
    console.log('✅ Connecté à PostgreSQL');
  } catch (err) {
    console.error('❌ Erreur de connexion:', err);
    process.exit(1);
  }
});
