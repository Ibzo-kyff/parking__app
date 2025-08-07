import { Request, Response } from 'express';
import { PrismaClient, ParkingStatus, Role } from '@prisma/client';

const prisma = new PrismaClient();

// CREATE PARKING
export const createParking = async (req: Request, res: Response) => {
  const {
    userId,
    name,
    address,
    phone,
    email,
    city, 
    description,
    capacity,
    hoursOfOperation,
    status,
  } = req.body;

  try {
    // Vérifie que l'utilisateur existe et a le rôle PARKING
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.PARKING) {
      return res.status(400).json({ error: "Utilisateur invalide ou non autorisé à gérer un parking." });
    }
     if (!city) {
      return res.status(400).json({ error: "Le champ 'city' est requis" });
    }
    // Vérifie qu'un parking n'existe pas déjà pour cet utilisateur
    const existingParking = await prisma.parking.findUnique({ where: { userId } });
    if (existingParking) {
      return res.status(400).json({ error: "Un parking est déjà associé à cet utilisateur." });
    }

    const newParking = await prisma.parking.create({
      data: {
        userId,
        name,
        address,
        phone,
        city, 
        email,
        description,
        capacity,
        hoursOfOperation,
        status: status || ParkingStatus.ACTIVE,
        logo: req.body.logo || undefined
      }
    });

    return res.status(201).json({ message: 'Parking créé avec succès', parking: newParking });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur lors de la création du parking', details: err.message || err });
  }
};

// GET ALL PARKINGS
export const getAllParkings = async (_req: Request, res: Response) => {
  try {
    const parkings = await prisma.parking.findMany({
      include: { user: true, vehicles: true }
    });
    return res.json(parkings);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des parkings' });
  }
};

// GET PARKING BY ID
export const getParkingById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const parking = await prisma.parking.findUnique({
      where: { id: parseInt(id) },
      include: { user: true, vehicles: true }
    });
    if (!parking) {
      return res.status(404).json({ error: 'Parking non trouvé' });
    }
    return res.json(parking);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération du parking' });
  }
};

// UPDATE PARKING
export const updateParking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    address,
    phone,
    city,
    email,
    description,
    capacity,
    hoursOfOperation,
    status
  } = req.body;

  try {
    const updatedParking = await prisma.parking.update({
      where: { id: parseInt(id) },
      data: {
        name,
        address,
        phone,
        city,
        email,
        description,
        capacity,
        hoursOfOperation,
        status,
        ...(req.body.logo && { logo: req.body.logo })
      }
    });
    return res.json({ message: 'Parking mis à jour', parking: updatedParking });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du parking' });
  }
};

// DELETE PARKING
export const deleteParking = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.parking.delete({ where: { id: parseInt(id) } });
    return res.json({ message: 'Parking supprimé avec succès' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la suppression du parking' });
  }
};
