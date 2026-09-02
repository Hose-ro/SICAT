import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Options } from 'multer';
import { extname } from 'node:path';

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.csv', '.json', '.md']);

export const reticulaUploadOptions: Options = {
  storage: memoryStorage(),
  fileFilter: (_request, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      callback(
        new BadRequestException(
          'La retícula debe ser un archivo XLSX, CSV, JSON o Markdown',
        ) as unknown as Error,
      );
      return;
    }
    callback(null, true);
  },
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
  },
};
