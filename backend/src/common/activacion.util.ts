import { createHash, randomInt } from 'node:crypto';
import { Prisma, TipoTokenAuth } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type PrismaLike = PrismaService | Prisma.TransactionClient;

// Sin 0/O, 1/I/L ni U/V: el código se dicta o se copia de una hoja impresa.
const ALFABETO = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
const LONGITUD = 8;
/** El código sirve un semestre: después se genera uno nuevo. */
export const VIGENCIA_CODIGO_MS = 180 * 24 * 60 * 60 * 1000;

function generarCodigo() {
  let codigo = '';
  for (let i = 0; i < LONGITUD; i += 1) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

/** Sin guion ni espacios y en mayúsculas: "k7p2 m9qx" vale igual que "K7P2-M9QX". */
export function normalizarCodigo(codigo: string) {
  return codigo.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Se guarda sólo el hash, ligado al usuario: aunque dos alumnos reciban el
 * mismo código, cada uno sólo abre su propia cuenta.
 */
export function hashCodigoActivacion(usuarioId: number, codigo: string) {
  return createHash('sha256')
    .update(`${usuarioId}:${normalizarCodigo(codigo)}`)
    .digest('hex');
}

/**
 * Genera un código nuevo por usuario e invalida los anteriores. Devuelve el
 * código en claro: es la única vez que se puede ver.
 */
export async function crearCodigosActivacion(
  prisma: PrismaLike,
  usuarioIds: number[],
  ahora = new Date(),
) {
  const codigos = usuarioIds.map((usuarioId) => ({
    usuarioId,
    codigo: generarCodigo(),
  }));
  if (!codigos.length) return codigos;
  await prisma.authToken.updateMany({
    where: {
      usuarioId: { in: usuarioIds },
      tipo: TipoTokenAuth.ACTIVACION_CUENTA,
      usedAt: null,
    },
    data: { usedAt: ahora },
  });
  await prisma.authToken.createMany({
    data: codigos.map(({ usuarioId, codigo }) => ({
      usuarioId,
      tipo: TipoTokenAuth.ACTIVACION_CUENTA,
      tokenHash: hashCodigoActivacion(usuarioId, codigo),
      expiresAt: new Date(ahora.getTime() + VIGENCIA_CODIGO_MS),
    })),
  });
  return codigos;
}
