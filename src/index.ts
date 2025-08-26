import express from 'express';
import path from 'path';
import authRoutes from './routes/authRoutes';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import vehiculeRoutes from './routes/vehiculeRoutes';
import parkingRoutes from './routes/parkingRoutes';
import reservationRoutes from './routes/reservationRoute';
import notificationRoutes from './routes/notificationRoute';
import multer from 'multer';
const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cookieParser());

// Ajout pour servir les dossiers statiques
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/auth', authRoutes);
app.use('/api/vehicules', vehiculeRoutes);
app.use('/api/parkings', parkingRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/notifications', notificationRoutes);

// Middleware global d'erreurs (Multer + génériques)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'MulterError') {
    return res.status(400).json({
      error: (err as any).message || 'Erreur upload',
      hint: "Utilisez Body=form-data avec un champ 'image'/'logo' ou 'file' de type Fichier. Ne laissez pas le nom de champ vide."
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