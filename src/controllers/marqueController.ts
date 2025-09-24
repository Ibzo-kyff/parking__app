import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { put, del } from '@vercel/blob';

const prisma = new PrismaClient();

// CREATE MARQUE
export const createMarque = async (req: Request, res: Response) => {
  try {
    const { name, isCustom } = req.body;

    // Validation des champs obligatoires
    if (!name) {
      return res.status(400).json({ error: 'Le champ name est obligatoire.' });
    }

    // Valider le format du booléen isCustom
    const parsedIsCustom = isCustom === 'true' ? true : false;

    // Uploader le logo vers Vercel Blob si fourni
    let logoUrl: string | undefined = undefined;
    const file = req.file as Express.Multer.File | undefined;
    if (file) {
      const newFilename = `marques/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? file.originalname.match(/\.[0-9a-z]+$/i)?.[0] : '.jpg'}`;
      const result = await put(newFilename, file.buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      logoUrl = result.url;
    }

    const marque = await prisma.marque.create({
      data: {
        name,
        logoUrl,
        isCustom: parsedIsCustom,
      },
    });

    return res.status(201).json({ message: 'Marque créée avec succès', marque });
  } catch (err) {
    console.error("Erreur lors de la création de la marque :", err);
    return res.status(500).json({
      error: "Erreur lors de la création de la marque",
      details: err instanceof Error ? err.message : "Erreur inconnue"
    });
  }
};

// GET ALL MARQUES WITH FILTERS
export const getAllMarques = async (req: Request, res: Response) => {
  const { name, isCustom } = req.query;

  try {
    const where: any = {};

    if (name) {
      where.name = { contains: name as string, mode: 'insensitive' };
    }

    if (isCustom !== undefined) {
      where.isCustom = isCustom === 'true';
    }

    const marques = await prisma.marque.findMany({
      where,
      include: {
        vehicles: true, // Optionnel : inclure les véhicules associés
      },
      orderBy: { name: 'asc' },
    });

    return res.json(marques);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des marques' });
  }
};

// GET MARQUE BY ID
export const getMarqueById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const marque = await prisma.marque.findUnique({
      where: { id: parseInt(id) },
      include: {
        vehicles: true, // Optionnel : inclure les véhicules associés
      },
    });

    if (!marque) {
      return res.status(404).json({ error: 'Marque non trouvée' });
    }

    return res.json(marque);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération de la marque' });
  }
};

// UPDATE MARQUE
export const updateMarque = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, isCustom } = req.body;

  try {
    // Vérifier si la marque existe
    const marque = await prisma.marque.findUnique({ where: { id: parseInt(id) } });
    if (!marque) {
      return res.status(404).json({ error: 'Marque non trouvée' });
    }

    // Gérer le booléen isCustom si fourni
    const parsedIsCustom = isCustom !== undefined ? isCustom === 'true' : undefined;

    // Gérer le nouveau logo si fourni
    let logoUrl = marque.logoUrl; // Garder l'existant par défaut
    const file = req.file as Express.Multer.File | undefined;
    if (file) {
      // Supprimer l'ancien blob si existant
      if (logoUrl) {
        try {
          const url = new URL(logoUrl);
          await del(url.pathname.slice(1));
        } catch (error) {
          console.warn(`Ancien logo non supprimé, URL invalide : ${logoUrl}`);
        }
      }

      // Uploader le nouveau logo
      const newFilename = `marques/${Date.now()}-${Math.round(Math.random() * 1e9)}${file.originalname ? file.originalname.match(/\.[0-9a-z]+$/i)?.[0] : '.jpg'}`;
      const result = await put(newFilename, file.buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      logoUrl = result.url;
    }

    const updatedMarque = await prisma.marque.update({
      where: { id: parseInt(id) },
      data: {
        name,
        logoUrl,
        isCustom: parsedIsCustom,
      },
    });

    return res.json({ message: 'Marque mise à jour', marque: updatedMarque });
  } catch (err) {
    console.error('Erreur lors de la mise à jour de la marque :', err);
    return res.status(500).json({
      error: 'Erreur lors de la mise à jour de la marque',
      details: err instanceof Error ? err.message : 'Erreur inconnue',
    });
  }
};

// DELETE MARQUE
export const deleteMarque = async (req: Request, res: Response) => {
  const { id } = req.params;
  const marqueId = parseInt(id, 10);

  if (isNaN(marqueId)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    // Vérifier si la marque existe et récupérer le logo
    const marque = await prisma.marque.findUnique({ where: { id: marqueId }, select: { logoUrl: true } });
    if (!marque) {
      return res.status(404).json({ error: 'Marque introuvable' });
    }

    // Supprimer le blob associé au logo si existant
    if (marque.logoUrl) {
      try {
        const url = new URL(marque.logoUrl);
        await del(url.pathname.slice(1));
      } catch (error) {
        console.warn(`Ancien logo non supprimé, URL invalide : ${marque.logoUrl}`);
      }
    }

    // Vérifier s'il y a des véhicules associés (optionnel : empêcher suppression si liés)
    const vehiclesCount = await prisma.vehicle.count({ where: { marqueId } });
    if (vehiclesCount > 0) {
      return res.status(400).json({ error: 'Impossible de supprimer : marque liée à des véhicules' });
    }

    // Supprimer la marque
    await prisma.marque.delete({
      where: { id: marqueId },
    });

    return res.json({ message: 'Marque supprimée avec succès' });
  } catch (err: any) {
    console.error('Erreur suppression marque:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Marque introuvable' });
    }
    return res.status(500).json({
      error: 'Erreur lors de la suppression de la marque',
      details: err.message || 'Erreur inconnue',
    });
  }
};