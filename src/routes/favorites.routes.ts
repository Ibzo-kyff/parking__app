import express from 'express';
import {
  addFavorite,
  removeFavorite,
  getUserFavorites
} from '../controllers/favorite.controller';

const router = express.Router();

// Ajouter un véhicule aux favoris
router.post('/', addFavorite);

// Supprimer un véhicule des favoris
router.delete('/:userId/:vehicleId', removeFavorite);

// Obtenir tous les favoris d’un utilisateur
router.get('/:userId', getUserFavorites);

export default router;
