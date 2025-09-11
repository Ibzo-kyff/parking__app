import { Request, Response } from 'express';
import { PrismaClient, ParkingStatus, Role } from '@prisma/client';
import { put, del } from '@vercel/blob'; 
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

    let logo: string | undefined;
    if (req.file) {
      // Upload vers Vercel Blob
      const newFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${req.file.originalname ? path.extname(req.file.originalname) : '.png'}`; // Utilisez path si importé, sinon adaptez
      const result = await put(newFilename, req.file.buffer, {
        access: 'public', 
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      logo = result.url; 
    }

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

// GET ALL PARKINGS (inchangé)
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

// GET PARKING BY ID (inchangé)
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
      // Supprimer l'ancien logo si existant (optionnel, pour nettoyer le storage)
      if (parking.logo) {
        // Extraire le pathname de l'URL blob (ex. : /uploads/filename.png)
        const url = new URL(parking.logo);
        await del(url.pathname.slice(1)); // del() supprime le blob par son chemin
      }

      // Upload nouveau logo vers Vercel Blob
      const newFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${req.file.originalname ? path.extname(req.file.originalname) : '.png'}`;
      const result = await put(newFilename, req.file.buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      newLogo = result.url;
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

// DELETE PARKING (optionnel : ajoutez suppression du logo si besoin)
export const deleteParking = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const parking = await prisma.parking.findUnique({ where: { id: parseInt(id) } });
    if (parking && parking.logo) {
      // Supprimer le logo du blob
      const url = new URL(parking.logo);
      await del(url.pathname.slice(1));
    }
    await prisma.parking.delete({ where: { id: parseInt(id) } });
    return res.json({ message: 'Parking supprimé avec succès' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la suppression du parking' });
  }
};