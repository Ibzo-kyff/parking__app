import { Request, Response } from 'express';
import { PrismaClient, ParkingStatus, Role } from '@prisma/client';
import fs from 'fs';
import path from 'path';

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
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user || user.role !== Role.PARKING) {
      return res.status(400).json({ error: "Utilisateur invalide ou non autorisé à gérer un parking." });
    }

    if (!city) {
      return res.status(400).json({ error: "Le champ 'city' est requis" });
    }

    const existingParking = await prisma.parking.findUnique({ where: { userId: Number(userId) } });
    if (existingParking) {
      return res.status(400).json({ error: "Un parking est déjà associé à cet utilisateur." });
    }

    const logo = req.file ? `/uploads/${req.file.filename}` : undefined;

    const newParking = await prisma.parking.create({
      data: {
        userId: Number(userId),
        name,
        address,
        phone,
        city, 
        email,
        description,
        capacity: capacity ? Number(capacity) : 0,
        hoursOfOperation,
        status: status || ParkingStatus.ACTIVE,
        logo
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
    // Vérifier si parking existe
    const parking = await prisma.parking.findUnique({ where: { id: Number(id) } });
    if (!parking) {
      return res.status(404).json({ error: 'Parking non trouvé' });
    }

    let newLogo = parking.logo;

    if (req.file) {
      // Supprimer ancien logo si existant
      if (parking.logo) {
        const oldPath = path.join(__dirname, "../../", parking.logo);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      newLogo = `/uploads/${req.file.filename}`;
    }

    const updatedParking = await prisma.parking.update({
      where: { id: Number(id) },
      data: {
        name,
        address,
        phone,
        city,
        email,
        description,
        capacity: capacity ? Number(capacity) : 0,
        hoursOfOperation,
        status,
        logo: newLogo
      }
    });

    return res.json({ message: 'Parking mis à jour', parking: updatedParking });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du parking', details: err.message || err });
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
