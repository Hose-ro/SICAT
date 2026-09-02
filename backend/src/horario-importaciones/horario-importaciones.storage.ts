import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Options } from 'multer';
import { readFile, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';

const PRIVATE_ROOT = join(process.cwd(), 'private-uploads', 'horarios');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const horarioFotoUploadOptions: Options = {
  storage: memoryStorage(),
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      const error = new BadRequestException(
        'La fotografía del horario debe ser JPG, PNG o WebP',
      ) as unknown as Error;
      callback(error);
      return;
    }
    callback(null, true);
  },
  limits: {
    files: 1,
    fileSize: 8 * 1024 * 1024,
  },
};

export function rutaFotoHorario(filename: string) {
  return join(PRIVATE_ROOT, basename(filename));
}

export function leerFotoHorario(filename: string) {
  return readFile(rutaFotoHorario(filename));
}

export async function eliminarFotoHorario(filename?: string | null) {
  if (!filename) return;
  try {
    await unlink(rutaFotoHorario(filename));
  } catch (error: unknown) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code !== 'ENOENT') throw error;
  }
}
