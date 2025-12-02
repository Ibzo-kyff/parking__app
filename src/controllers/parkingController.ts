import { Request, Response } from 'express';
import { PrismaClient, ParkingStatus, Role } from '@prisma/client';
import { put, del } from '@vercel/blob'; 
import path from 'path';
import { JwtPayload } from 'jsonwebtoken';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: JwtPayload & { id: number; role: Role };
}

// CREATE PARKING
export const createParking = async (req: AuthRequest, res: Response) => {
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
    if (!req.user || Number(userId) !== req.user.id) {
      return res.status(403).json({ error: "Non autorisé" });
    }

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

    let logoUrl: string | undefined = undefined;

    if (req.file) {
      try {
        // Upload vers Vercel Blob
        const blob = await put(`parking-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`, 
          req.file.buffer, {
            access: 'public',
          }
        );
        logoUrl = blob.url;
      } catch (uploadError) {
        console.error('Erreur upload Vercel Blob:', uploadError);
        return res.status(500).json({ error: 'Erreur lors du téléchargement de l\'image' });
      }
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
        logo: logoUrl
      }
    });

    return res.status(201).json({ message: 'Parking créé avec succès', parking: newParking });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur lors de la création du parking', details: err.message });
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

// GET MY PARKING
export const getMyParking = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const parking = await prisma.parking.findUnique({
      where: { userId: req.user.id },
      include: { user: true, vehicles: true }
    });

    if (!parking) {
      return res.status(404).json({ error: 'Parking non trouvé' });
    }

    return res.json(parking);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur lors de la récupération du parking', details: err.message });
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
export const updateParking = async (req: AuthRequest, res: Response) => {
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
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Vérifier si parking existe
    const parking = await prisma.parking.findUnique({ where: { id: Number(id) } });
    if (!parking) {
      return res.status(404).json({ error: 'Parking non trouvé' });
    }

    if (parking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé à modifier ce parking' });
    }

    let newLogo = parking.logo;

    if (req.file) {
      // Supprimer l'ancien logo si existant et si c'est une URL valide
      if (parking.logo) {
        try {
          const url = new URL(parking.logo);
          await del(url.pathname.slice(1)); // Supprime le blob si c'est une URL valide
        } catch (error) {
          // Si parking.logo n'est pas une URL valide, on ignore l'erreur (ancien chemin local par ex.)
          console.warn(`Ancien logo non supprimé, URL invalide : ${parking.logo}`);
        }
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
export const deleteParking = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const parking = await prisma.parking.findUnique({ where: { id: parseInt(id) } });
    if (!parking) {
      return res.status(404).json({ error: 'Parking non trouvé' });
    }

    if (parking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé à supprimer ce parking' });
    }

    if (parking.logo) {
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