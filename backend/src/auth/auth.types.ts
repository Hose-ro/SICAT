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
  /** Id de la fila `Sesion` que respalda el token actual (uno por dispositivo). */
  sid: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/** Forma pública del usuario que se devuelve en las respuestas de auth
 *  (login, cambio de contraseña); a diferencia de `AuthenticatedUser`, no
 *  incluye el `sid` interno de la sesión. */
export type PublicAuthUser = Omit<AuthenticatedUser, 'sid'>;

export interface AuthRequestContext {
  ip?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}
