import type { Request } from 'express';
import type { Rol } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export interface AuthenticatedUser {
  id: number;
  nombre: string;
  email: string | null;
  numeroControl: string | null;
  username: string | null;
  rol: Rol;
  tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface AuthRequestContext {
  ip?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}
