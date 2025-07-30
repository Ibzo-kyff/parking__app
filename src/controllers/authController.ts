import { Request, Response } from 'express';
import { PrismaClient, Role, Status } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from '../utils/jwtUtils';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { JwtPayload } from 'jsonwebtoken';

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

// Validation du corps de la requête
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const register = async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phone: data.phone || '' }],
      },
    });

    if (existing) {
      return res.status(409).json({ message: 'Email ou téléphone déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        phone: data.phone,
        role: data.role,
        status: Status.PENDING,
      },
    });

    // Génération du token de vérification et expiration
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Génération des tokens JWT
    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // Mise à jour unique avec tous les champs
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpires,
        refreshToken,
      },
    });

    // Envoi de l'email de vérification
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    const mailOptions = {
      to: data.email,
      subject: 'Vérification de votre email',
      html: `Cliquez <a href="${verificationUrl}">ici</a> pour vérifier votre email. Ce lien expire dans 24 heures.`,
    };

    await transporter.sendMail(mailOptions);

    // Stockage du cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Activer en production avec HTTPS
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    });

    return res.status(201).json({ message: 'Inscription réussie', accessToken });
  } catch (err) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Données invalides', errors: err.issues });
    } else if (err instanceof Error && err.name === 'SendMailError') {
      return res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email de vérification' });
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

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

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

    return res.status(200).json({ message: 'Connexion réussie', accessToken });
  } catch (err) {
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
    return res.status(401).json({ message: 'Refresh token missing' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as { id: number };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id, refreshToken },
    });

    if (!user) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const newAccessToken = generateAccessToken({ 
      id: user.id, 
      email: user.email, 
      role: user.role 
    });

    const newRefreshToken = generateRefreshToken({ 
      id: user.id, 
      email: user.email 
    });

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
  } catch (err) {
    return res.status(403).json({ message: 'Invalid refresh token' });
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
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const sendVerificationEmail = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).send();

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      verificationToken: token,
      verificationTokenExpires: expires,
    },
  });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

  const mailOptions = {
    to: req.user.email,
    subject: 'Vérification de votre email',
    html: `Cliquez <a href="${verificationUrl}">ici</a> pour vérifier votre email.`,
  };

  await transporter.sendMail(mailOptions);

  res.json({ message: 'Email de vérification envoyé' });
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.params;

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
      verificationTokenExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({ message: 'Token invalide ou expiré' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
    },
  });

  res.json({ message: 'Email vérifié avec succès' });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetExpires: expires,
    },
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const mailOptions = {
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe',
    html: `Cliquez <a href="${resetUrl}">ici</a> pour réinitialiser votre mot de passe.`,
  };

  await transporter.sendMail(mailOptions);

  res.json({ message: 'Lien de réinitialisation envoyé' });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({ message: 'Token invalide ou expiré' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshToken: null, // Invalider toutes les sessions
    },
  });

  res.json({ message: 'Mot de passe réinitialisé avec succès' });
};