import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Ajouter un favori
 */
export const addFavorite = async (req: Request, res: Response) => {
  const { userId, vehicleId } = req.body;

  try {
    // Vérifie si le favori existe déjà (clé composite unique)
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_vehicleId: {
          userId: parseInt(userId),
          vehicleId: parseInt(vehicleId)
        }
      }
    });

    if (existingFavorite) {
      return res.status(400).json({
        message: 'Ce véhicule est déjà dans les favoris.'
      });
    }

    // Crée le favori
    const favorite = await prisma.favorite.create({
      data: {
        userId: parseInt(userId),
        vehicleId: parseInt(vehicleId)
      }
    });

    res.status(201).json({
      message: 'Véhicule ajouté aux favoris avec succès.',
      data: favorite
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Erreur lors de l’ajout du favori.',
      details: err.message
    });
  }
};

/**
 * Supprimer un favori
 */
export const removeFavorite = async (req: Request, res: Response) => {
  const { userId, vehicleId } = req.params;

  try {
    await prisma.favorite.delete({
      where: {
        userId_vehicleId: {
          userId: parseInt(userId),
          vehicleId: parseInt(vehicleId)
        }
      }
    });

    res.json({ message: 'Favori supprimé avec succès.' });
  } catch (err: any) {
    res.status(500).json({
      error: 'Erreur lors de la suppression du favori.',
      details: err.message
    });
  }
};

/**
 * Obtenir tous les favoris d’un utilisateur
 */
export const getUserFavorites = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: parseInt(userId) },
      include: { vehicle: true }
    });

    res.json({
      message: 'Liste des favoris récupérée avec succès.',
      data: favorites
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Erreur lors de la récupération des favoris.',
      details: err.message
    });
  }
};
