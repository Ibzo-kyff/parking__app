import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role, Status } from '@prisma/client';
import multer from 'multer';
import path from 'path';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, { message: 'Le mot de passe doit avoir au moins 8 caractères' })
    .regex(/[A-Z]/, { message: 'Le mot de passe doit contenir une majuscule' })
    .regex(/[0-9]/, { message: 'Le mot de passe doit contenir un chiffre' }),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }
  next();
};

export const validateLogin = (req: Request, res: Response, next: NextFunction) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }
  next();
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});

export const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées !'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});