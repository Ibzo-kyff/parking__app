import jwt from 'jsonwebtoken';

export const generateAccessToken = (payload: { id: number; email: string; role: string }) => {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: '30m' });
};

export const generateRefreshToken = (payload: { id: number; email: string; role: string }) => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: '7d' });
};