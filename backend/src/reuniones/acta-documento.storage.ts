import { BadRequestException } from '@nestjs/common';
import type { Options } from 'multer';
import { extname } from 'node:path';
import { validatedUploadStorage } from '../common/uploads/validated-upload';
import { FORMATOS_DOCUMENTO, MAX_DOCUMENTO_ACTA } from './reuniones.service';

/** Acta firmada: un PDF o un Word, validado y en memoria (se guarda en la BD). */
export const actaDocumentoUploadOptions: Options = {
  storage: validatedUploadStorage({ maxBytes: MAX_DOCUMENTO_ACTA }),
  fileFilter: (_request, file, callback) => {
    if (!FORMATOS_DOCUMENTO[extname(file.originalname).toLowerCase()]) {
      const error = new BadRequestException(
        'El acta debe ser PDF o Word (.docx)',
      ) as unknown as Error;
      callback(error);
      return;
    }
    callback(null, true);
  },
  limits: { files: 1, fileSize: MAX_DOCUMENTO_ACTA },
};
