import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { StorageEngine } from 'multer';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import * as CFB from 'cfb';
import JSZip from 'jszip';

const IMAGE_FORMATS = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp',
} as const;

function invalidFile() {
  return new BadRequestException(
    'El contenido del archivo no coincide con su extensión, está dañado o no es un formato permitido',
  );
}

// Decode and encode pixels: never copy EXIF, GPS, XMP, IPTC or ICC metadata.
export async function validateUpload(
  buffer: Buffer,
  name: string,
  imagesOnly = false,
): Promise<{ buffer: Buffer; mimetype: string }> {
  const extension = extname(name).toLowerCase();
  try {
    const format = IMAGE_FORMATS[extension] as
      | 'jpeg'
      | 'png'
      | 'webp'
      | undefined;
    if (format) {
      const image = sharp(buffer, {
        failOn: 'warning',
        limitInputPixels: 40_000_000,
      });
      const metadata = await image.metadata();
      if (metadata.format !== format || (metadata.pages ?? 1) !== 1) {
        throw invalidFile();
      }
      const clean = await image.rotate().toFormat(format).toBuffer();
      return { buffer: clean, mimetype: `image/${format}` };
    }
    if (imagesOnly) throw invalidFile();

    if (extension === '.pdf') {
      if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        throw invalidFile();
      }
      const pdf = await PDFDocument.load(buffer, {
        throwOnInvalidObject: true,
      });
      if (!pdf.getPageCount()) throw invalidFile();
      return { buffer, mimetype: 'application/pdf' };
    }
    if (extension === '.doc') {
      if (
        !buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))
      ) {
        throw invalidFile();
      }
      const container = CFB.read(buffer, { type: 'buffer' });
      const document = CFB.find(container, 'WordDocument');
      const table =
        CFB.find(container, '0Table') ?? CFB.find(container, '1Table');
      if (
        !document ||
        !table ||
        !document.content ||
        document.size < 32 ||
        Buffer.from(document.content).readUInt16LE(0) !== 0xa5ec
      ) {
        throw invalidFile();
      }
      return { buffer, mimetype: 'application/msword' };
    }
    if (extension === '.docx') {
      if (!buffer.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'))) {
        throw invalidFile();
      }
      const zip = await JSZip.loadAsync(buffer);
      const types = zip.file('[Content_Types].xml');
      const document = zip.file('word/document.xml');
      if (!types || !document || zip.file(/vbaProject\.bin$/i).length) {
        throw invalidFile();
      }
      const xml = (await readZipEntry(types, 256 * 1024)).toString('utf8');
      if (
        !xml.includes(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
        )
      ) {
        throw invalidFile();
      }
      const body = (await readZipEntry(document, 30 * 1024 * 1024)).toString(
        'utf8',
      );
      if (
        !/<(?:\w+:)?document\b/.test(body) ||
        !body.includes(
          'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        )
      ) {
        throw invalidFile();
      }
      return {
        buffer,
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }
    throw invalidFile();
  } catch {
    throw invalidFile();
  }
}

function readZipEntry(
  entry: JSZip.JSZipObject,
  limit: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = entry.nodeStream();
    stream.on('data', (bytes: Buffer) => {
      size += bytes.length;
      if (size > limit) {
        stream.pause();
        reject(invalidFile());
        return;
      }
      chunks.push(bytes);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.resume();
  });
}

// Multer cleans up earlier files in a batch if another file fails validation.
// The original bytes stay in memory and never reach public storage.
export function validatedUploadStorage(options: {
  directory?: string;
  imagesOnly?: boolean;
  maxBytes: number;
}): StorageEngine {
  return {
    _handleFile(_request, file, callback) {
      const processFile = async () => {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of file.stream) {
          const bytes = Buffer.from(chunk);
          size += bytes.length;
          if (size > options.maxBytes) throw invalidFile();
          chunks.push(bytes);
        }
        if (
          (file.stream as typeof file.stream & { truncated?: boolean })
            .truncated
        ) {
          throw invalidFile();
        }
        const clean = await validateUpload(
          Buffer.concat(chunks),
          file.originalname,
          options.imagesOnly,
        );
        if (clean.buffer.length > options.maxBytes) throw invalidFile();
        if (!options.directory) {
          return { ...clean, size: clean.buffer.length };
        }
        await mkdir(options.directory, { recursive: true });
        const filename = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
        const path = join(options.directory, filename);
        try {
          await writeFile(path, clean.buffer, { flag: 'wx' });
        } catch (error) {
          await unlink(path).catch(() => undefined);
          throw error;
        }
        return {
          destination: options.directory,
          filename,
          path,
          mimetype: clean.mimetype,
          size: clean.buffer.length,
        };
      };
      void processFile().then(
        (result) => callback(null, result),
        (error: Error) => callback(error),
      );
    },
    _removeFile(_request, file, callback) {
      if (!file.path) {
        delete (file as Partial<Express.Multer.File>).buffer;
        callback(null);
        return;
      }
      void unlink(file.path).then(
        () => callback(null),
        (error: Error) => callback(error),
      );
    },
  };
}
