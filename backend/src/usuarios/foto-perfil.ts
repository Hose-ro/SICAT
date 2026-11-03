import { BadRequestException } from '@nestjs/common';
import type { Options } from 'multer';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import sharp from 'sharp';
import { validatedUploadStorage } from '../common/uploads/validated-upload';

/** Lo que puede pesar el archivo que llega (el navegador ya lo achica). */
export const MAX_FOTO_PERFIL = 5 * 1024 * 1024;
/** Lado de la foto guardada: alcanza para el avatar más grande en pantallas 2x. */
const LADO_FOTO = 512;
/** Debajo de esto la foto se vería pixelada incluso en el avatar chico. */
const LADO_MINIMO = 64;

const EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function formatoInvalido() {
  return new BadRequestException(
    'La foto debe ser una imagen JPG, PNG o WebP de hasta 5 MB',
  ) as unknown as Error;
}

/**
 * La extensión y el tipo que declara el navegador se revisan aquí; después
 * `validatedUploadStorage` decodifica la imagen y exige que el contenido real
 * coincida con la extensión (nada de SVG, GIF animados ni archivos
 * disfrazados). Todo queda en memoria: nunca toca el disco.
 */
export const fotoPerfilUploadOptions: Options = {
  storage: validatedUploadStorage({
    imagesOnly: true,
    maxBytes: MAX_FOTO_PERFIL,
  }),
  fileFilter: (_request, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES.has(extension) || !MIMES.has(file.mimetype)) {
      callback(formatoInvalido());
      return;
    }
    callback(null, true);
  },
  limits: { files: 1, fields: 0, parts: 1, fileSize: MAX_FOTO_PERFIL },
};

/**
 * Re-codifica la foto desde los píxeles: cuadrada, centrada en lo más
 * llamativo (normalmente la cara), en WebP y sin metadatos. Lo que se guarda
 * nunca son los bytes que mandó la persona, así que cualquier carga oculta en
 * el archivo original se pierde aquí.
 */
export async function procesarFotoPerfil(buffer: Buffer) {
  try {
    const imagen = sharp(buffer, {
      failOn: 'warning',
      limitInputPixels: 40_000_000,
    });
    const { width = 0, height = 0 } = await imagen.metadata();
    if (Math.min(width, height) < LADO_MINIMO) {
      throw new BadRequestException(
        `La foto es muy pequeña: usa una de al menos ${LADO_MINIMO}×${LADO_MINIMO} píxeles`,
      );
    }
    const contenido = await imagen
      .rotate()
      .resize(LADO_FOTO, LADO_FOTO, {
        fit: 'cover',
        position: sharp.strategy.attention,
      })
      .webp({ quality: 82 })
      .toBuffer();
    const huella = createHash('sha256')
      .update(contenido)
      .digest('hex')
      .slice(0, 16);
    return { contenido, mime: 'image/webp', huella };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw formatoInvalido();
  }
}
