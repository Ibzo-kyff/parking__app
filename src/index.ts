import express from 'express';
import authRoutes from './routes/authRoutes';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import vehiculeRoutes from './routes/vehicule.routes';
import parkingRoutes from './routes/parking.routes';
import vehicleStatsRoutes from './routes/vehicleStats.routes';
import vehicleHistoryRoutes from './routes/vehicleHistory.routes'; 
import favoriteRoutes from './routes/favorites.routes';


const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/vehicules', vehiculeRoutes);
app.use('/api/parkings', parkingRoutes);
app.use('/api/vehiculesStats', vehicleStatsRoutes);
app.use('/api/vehiculeshistory', vehicleHistoryRoutes);
app.use('/api/favorites', favoriteRoutes);
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