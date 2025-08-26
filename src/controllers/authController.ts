import { Request, Response } from 'express';
import { PrismaClient, Role, Status } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from '../utils/jwtUtils';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { JwtPayload } from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

interface AuthRequest extends Request {
  user?: JwtPayload;
}

const prisma = new PrismaClient();
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Fonction pour générer un OTP à 4 chiffres
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Envoyer un OTP par email
const sendOTPEmail = async (email: string, otp: string, purpose: 'reset' | 'verify') => {
  try {
    const subject = purpose === 'reset' 
      ? 'Réinitialisation de votre mot de passe' 
      : 'Vérification de votre email';
    
    const text = purpose === 'reset'
      ? `Votre code OTP pour réinitialiser votre mot de passe est : ${otp}. Ce code expire dans 15 minutes.`
      : `Votre code OTP pour vérifier votre email est : ${otp}. Ce code expire dans 15 minutes.`;

    const mailOptions = {
      to: email,
      subject,
      text,
      html: `<p>Votre code OTP est : <strong>${otp}</strong>. Ce code expire dans 15 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email OTP:', error);
    throw new Error('Échec de l\'envoi de l\'email OTP');
  }
};

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(8).max(15),
  nom: z.string().min(1, 'Le nom est requis'),
  prenom: z.string().min(1, 'Le prénom est requis'),
  image: z.string().url().optional(),
  address: z.string().optional(),
  role: z.nativeEnum(Role),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const verifyOTPSchema = z.object({
  email: z.string().email('Email invalide'),
  otp: z.string().length(4, 'Le code OTP doit avoir 4 chiffres'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
  otp: z.string().length(4, 'Le code OTP doit avoir 4 chiffres'),
  password: z.string().min(6, 'Le mot de passe doit avoir au moins 6 caractères'),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).max(15).optional(),
  nom: z.string().min(1).optional(),
  prenom: z.string().min(1).optional(),
  image: z.string().url().optional(),
  address: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(Status).optional(),
  emailVerified: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

const selfUpdateSchema = z.object({
  phone: z.string().min(8).max(15).optional(),
  nom: z.string().min(1).optional(),
  prenom: z.string().min(1).optional(),
  image: z.string().url().optional(),
  address: z.string().optional(),
  password: z.string().min(6).optional(),
});

export const register = async (req: Request, res: Response) => {
  try {
    const image = (req as any).file ? `/uploads/${(req as any).file.filename}` : undefined;

    const body = { ...req.body, ...(image ? { image } : {}) };
    const data = registerSchema.parse(body);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    });

    if (existing) {
      if ((req as any).file) {
        try { await fs.promises.unlink(path.join(__dirname, '../../uploads', (req as any).file.filename)); } catch (e) { /* ignore */ }
      }
      return res.status(409).json({ message: 'Email ou téléphone déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        phone: data.phone,
        nom: data.nom,
        prenom: data.prenom,
        image: data.image,
        address: data.address,
        role: data.role,
        status: data.role === 'CLIENT' ? Status.APPROVED : Status.PENDING,
      },
    });

    if (!user.emailVerified) {
      const otp = generateOTP();
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifyOTP: otp, emailVerifyOTPExpires: expires },
      });

      await sendOTPEmail(data.email, otp, 'verify');
    }

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({ 
      message: 'Inscription réussie. Vérifiez votre email avec le code OTP.', 
      accessToken,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified
    });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    if (user.status === Status.PENDING) {
      return res.status(403).json({ message: 'Compte en attente d\'approbation.' });
    }

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    const parking = user.role === "PARKING"
  ? await prisma.parking.findUnique({
      where: { userId: user.id },
      select: { id: true }
    })
  : null;
    return res.status(200).json({
      message: 'Connexion réussie',
      accessToken,
      role: user.role,
      emailVerified: user.emailVerified,
      nom: user.nom,
      prenom: user.prenom,
      id: user.id,
      parkingId: parking?.id ?? null
    });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const refreshTokenHandler = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token manquant' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as { id: number; email: string; role: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id, refreshToken },
    });

    if (!user || user.status === Status.PENDING) {
      return res.status(403).json({ message: 'Refresh token invalide ou compte en attente' });
    }

    const newAccessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const newRefreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ accessToken: newAccessToken });
  } catch (err: unknown) {
    return res.status(403).json({ message: 'Refresh token invalide' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const user = await prisma.user.findFirst({ where: { refreshToken } });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
      }
    }
    res.clearCookie('refreshToken');
    return res.status(200).json({ message: 'Déconnexion réussie' });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const sendVerificationEmail = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });

  try {
    const otp = generateOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        emailVerifyOTP: otp,
        emailVerifyOTPExpires: expires,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    await sendOTPEmail(req.user.email, otp, 'verify');

    res.json({ 
      message: 'Code OTP de vérification envoyé',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur lors de l\'envoi du code OTP' });
  }
};

export const verifyEmailWithOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = verifyOTPSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        email,
        emailVerifyOTP: otp,
        emailVerifyOTPExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Code OTP invalide ou expiré' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyOTP: null,
        emailVerifyOTPExpires: null,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    res.json({ message: 'Email vérifié avec succès' });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: 'Si cet email existe, un code OTP a été envoyé' });
    }

    const otp = generateOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOTP: otp,
        passwordResetOTPExpires: expires,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await sendOTPEmail(user.email, otp, 'reset');

    res.json({ 
      message: 'Code OTP envoyé par email',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur lors de l\'envoi du code OTP' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, password } = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        email,
        passwordResetOTP: otp,
        passwordResetOTPExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Code OTP invalide ou expiré' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetOTP: null,
        passwordResetOTPExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        refreshToken: null,
      },
    });

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const verifyResetOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        email,
        passwordResetOTP: otp,
        passwordResetOTPExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Code OTP invalide ou expiré' });
    }

    return res.json({ 
      message: 'Code OTP validé',
      verified: true 
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent voir tous les utilisateurs.' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        nom: true,
        prenom: true,
        image: true,
        address: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(users);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'ID invalide' });
    }

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.id !== userId)) {
      return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs ou le propriétaire peuvent voir cet utilisateur.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        nom: true,
        prenom: true,
        image: true,
        address: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    return res.status(200).json(user);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        nom: true,
        prenom: true,
        image: true,
        address: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    return res.status(200).json(user);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'ID invalide' });
    }

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.id !== userId)) {
      return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs ou le propriétaire peuvent modifier cet utilisateur.' });
    }

    const data = updateUserSchema.parse(req.body);

    if (req.user.role !== 'ADMIN' && (data.role || data.status)) {
      return res.status(403).json({ message: 'Seuls les administrateurs peuvent modifier le rôle ou le statut.' });
    }

    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: data.email,
        phone: data.phone,
        nom: data.nom,
        prenom: data.prenom,
        image: data.image,
        address: data.address,
        role: data.role,
        status: data.status,
        emailVerified: data.emailVerified,
        password: hashedPassword,
      },
    });

    return res.status(200).json({ message: 'Utilisateur mis à jour avec succès', user: updatedUser });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    } else if (err instanceof Error && 'code' in err && err.code === 'P2025') {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    // If a file was uploaded, use it
    const image = (req as any).file ? `/uploads/${(req as any).file.filename}` : undefined;

    // merge image into body for zod parsing
    const body = { ...req.body, ...(image ? { image } : {}) };

    const data = selfUpdateSchema.parse(body);

    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        phone: data.phone,
        nom: data.nom,
        prenom: data.prenom,
        image: data.image,
        address: data.address,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        nom: true,
        prenom: true,
        image: true,
        address: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({ message: 'Profil mis à jour avec succès', user: updatedUser });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    } else if (err instanceof Error && 'code' in err && err.code === 'P2025') {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'ID invalide' });
    }

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.id !== userId)) {
      return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs ou le propriétaire peuvent supprimer cet utilisateur.' });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof Error && 'code' in err && err.code === 'P2025') {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};