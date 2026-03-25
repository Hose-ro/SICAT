import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import type { Options } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'tareas');
const MAX_FILES = 12;

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

export function ensureTareasUploadDir() {
  if (!existsSync(UPLOAD_ROOT)) {
    mkdirSync(UPLOAD_ROOT, { recursive: true });
  }
}

function sanitizeBaseName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export const tareasUploadOptions: Options = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      ensureTareasUploadDir();
      cb(null, UPLOAD_ROOT);
    },
    filename: (_req, file, cb) => {
      const extension = extname(file.originalname).toLowerCase();
      const base =
        sanitizeBaseName(file.originalname.replace(extension, '')) || 'archivo';
      cb(
        null,
        `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${extension}`,
      );
    },
  }),
  fileFilter: (_req, file, cb) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return cb(
        new BadRequestException(
          'Solo se permiten archivos PDF, Word o imágenes',
        ) as any,
        false,
      );
    }
    cb(null, true);
  },
  limits: {
    files: MAX_FILES,
    fileSize: 15 * 1024 * 1024,
  },
};

export function buildPublicUploadUrl(filename: string) {
  return `/uploads/tareas/${filename}`;
}

export function fileTypeFromName(name: string) {
  const extension = extname(name).toLowerCase();
  if (extension === '.pdf') return 'PDF';
  if (extension === '.doc' || extension === '.docx') return 'WORD';
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) return 'IMAGEN';
  return 'OTRO';
}

export function isImageFile(name: string) {
  return ['.png', '.jpg', '.jpeg', '.webp'].includes(
    extname(name).toLowerCase(),
  );
}

export function getUploadAbsolutePath(filename: string) {
  return join(UPLOAD_ROOT, filename);
}

export function collectUploadedFiles(
  files?: Record<string, Express.Multer.File[]>,
): Express.Multer.File[] {
  if (!files) return [];
  return Object.values(files).flat().filter(Boolean);
}
