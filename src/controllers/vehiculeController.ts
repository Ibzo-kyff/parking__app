import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CREATE VEHICULE
export const createVehicule = async (req: Request, res: Response) => {
  const {
    parkingId,
    marque,
    prix,
    description,
    photos,
    garantie,
    dureeGarantie,
    documents,
    chauffeur
  } = req.body;

  try {
    const vehicule = await prisma.vehicle.create({
      data: {
        parkingId,
        marque,
        prix,
        description,
        photos,
        garantie,
        dureeGarantie,
        documents,
        chauffeur
      }
    });

    return res.status(201).json({ message: 'Véhicule enregistré', vehicule });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur lors de la création du véhicule' });
  }
};

// GET ALL VEHICULES
export const getAllVehicules = async (_req: Request, res: Response) => {
  try {
    const vehicules = await prisma.vehicle.findMany({
      include: {
        parking: true,
        stats: true,
        favorites: true
      }
    });

    return res.json(vehicules);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des véhicules' });
  }
};

// GET VEHICULE BY ID
export const getVehiculeById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const vehicule = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) },
      include: {
        parking: true,
        stats: true,
        favorites: true
      }
    });

    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    return res.json(vehicule);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération du véhicule' });
  }
};

// UPDATE VEHICULE
export const updateVehicule = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    marque,
    prix,
    description,
    photos,
    garantie,
    dureeGarantie,
    documents,
    chauffeur
  } = req.body;

  try {
    const updatedVehicule = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: {
        marque,
        prix,
        description,
        photos,
        garantie,
        dureeGarantie,
        documents,
        chauffeur
      }
    });

    return res.json({ message: 'Véhicule mis à jour', vehicule: updatedVehicule });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du véhicule' });
  }
};

// DELETE VEHICULE
export const deleteVehicule = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.vehicle.delete({
      where: { id: parseInt(id) }
    });

    return res.json({ message: 'Véhicule supprimé avec succès' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la suppression du véhicule' });
  }
};
