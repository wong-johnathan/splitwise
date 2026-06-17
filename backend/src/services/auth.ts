import jwt from 'jsonwebtoken';
import { config } from '../config';

export function signToken(userId: number): string {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number } {
  return jwt.verify(token, config.JWT_SECRET) as { userId: number };
}
