import { BadRequestException } from '@nestjs/common';
import express from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import multer from 'multer';
import request from 'supertest';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import * as CFB from 'cfb';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateUpload, validatedUploadStorage } from './validated-upload';
import { horarioFotoUploadOptions } from '../../horario-importaciones/horario-importaciones.storage';

async function photo(format: 'jpeg' | 'png' | 'webp' = 'jpeg') {
  return sharp({
    create: { width: 12, height: 8, channels: 3, background: 'red' },
  })
    .toFormat(format)
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD0: { Make: 'Private device', Model: 'Private model' },
      IFD2: { DateTimeOriginal: '2026:09:08 10:00:00' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '19/1 25/1 0/1' },
    })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">Private location</x:xmpmeta>')
    .toBuffer();
}

describe('upload content validation and privacy', () => {
  it('distinguishes legacy Word from other compound documents', async () => {
    const container = CFB.utils.cfb_new();
    CFB.utils.cfb_add(container, 'Workbook', Buffer.from('Excel'));
    const encode = () =>
      Buffer.from(CFB.write(container, { type: 'buffer' }) as Uint8Array);
    await expect(validateUpload(encode(), 'fake.doc')).rejects.toThrow();
    const word = Buffer.alloc(32);
    word.writeUInt16LE(0xa5ec);
    CFB.utils.cfb_add(container, 'WordDocument', word);
    CFB.utils.cfb_add(container, '0Table', Buffer.alloc(32));
    expect((await validateUpload(encode(), 'word.doc')).mimetype).toBe(
      'application/msword',
    );
  });

  it('bounds decompression of Word package entries', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', 'x'.repeat(256 * 1024 + 1));
    zip.file('word/document.xml', 'x');
    await expect(
      validateUpload(
        await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
        'large.docx',
      ),
    ).rejects.toThrow();
  });

  it.each(['jpg', 'png', 'webp', 'pdf', 'doc', 'docx'])(
    'rejects text renamed to .%s',
    async (ext) => {
      await expect(
        validateUpload(Buffer.from('<script>bad()</script>'), `fake.${ext}`),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(['jpeg', 'png', 'webp'] as const)(
    'strips private metadata from %s and preserves orientation',
    async (format) => {
      const source = await photo(format);
      expect((await sharp(source).metadata()).exif).toBeDefined();
      const result = await validateUpload(source, `photo.${format}`);
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata).toMatchObject({ width: 8, height: 12, format });
      for (const key of ['exif', 'xmp', 'iptc', 'icc', 'orientation']) {
        expect(metadata[key]).toBeUndefined();
      }
      expect(result.mimetype).toBe(`image/${format}`);
    },
  );

  it('rejects renamed images, truncated images and SVG', async () => {
    const source = await photo();
    await expect(validateUpload(source, 'renamed.png')).rejects.toThrow();
    await expect(
      validateUpload(source.subarray(0, source.length - 40), 'broken.jpg'),
    ).rejects.toThrow();
    await expect(
      validateUpload(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        ),
        'fake.png',
      ),
    ).rejects.toThrow();
  });

  it('accepts a parsed PDF but rejects a fake header and PDF in an image-only upload', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    expect((await validateUpload(bytes, 'document.pdf')).mimetype).toBe(
      'application/pdf',
    );
    await expect(
      validateUpload(Buffer.from('%PDF-1.7\nnot a PDF'), 'fake.pdf'),
    ).rejects.toThrow();
    await expect(validateUpload(bytes, 'document.pdf', true)).rejects.toThrow();
  });

  it('rejects a generic ZIP renamed to Word and accepts a Word package', async () => {
    const zip = new JSZip();
    zip.file('hello.txt', 'hello');
    await expect(
      validateUpload(
        await zip.generateAsync({ type: 'nodebuffer' }),
        'fake.docx',
      ),
    ).rejects.toThrow();
    zip.file(
      '[Content_Types].xml',
      '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    );
    zip.file(
      'word/document.xml',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
    );
    expect(
      (
        await validateUpload(
          await zip.generateAsync({ type: 'nodebuffer' }),
          'real.docx',
        )
      ).mimetype,
    ).toContain('wordprocessingml');
    zip.file('word/vbaProject.bin', 'macro');
    await expect(
      validateUpload(
        await zip.generateAsync({ type: 'nodebuffer' }),
        'macro.docx',
      ),
    ).rejects.toThrow();
  });

  it('validates horario multipart before the handler and supplies only clean bytes', async () => {
    const app = express();
    const handler = jest.fn((req: Request, res: Response) => {
      res.json({ mimetype: req.file!.mimetype, size: req.file!.size });
    });
    app.post(
      '/',
      multer(horarioFotoUploadOptions).single('fotoHorario'),
      handler,
    );
    const errors: ErrorRequestHandler = (_err, _req, res, _next) => {
      void _next;
      res.sendStatus(400);
    };
    app.use(errors);
    await request(app)
      .post('/')
      .attach('fotoHorario', Buffer.from('fake'), {
        filename: 'fake.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect(handler).not.toHaveBeenCalled();
    await request(app)
      .post('/')
      .attach('fotoHorario', await photo(), {
        filename: 'real.jpg',
        contentType: 'image/png',
      })
      .expect(200);
    const received = handler.mock.calls[0][0].file!;
    expect(received.mimetype).toBe('image/jpeg');
    expect((await sharp(received.buffer).metadata()).exif).toBeUndefined();
  });

  it('writes only sanitized bytes and removes earlier batch files when a later file fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sicat-upload-test-'));
    try {
      const app = express();
      app.post(
        '/',
        multer({
          storage: validatedUploadStorage({ directory, maxBytes: 1024 * 1024 }),
          limits: { fileSize: 1024 * 1024 },
        }).array('archivos'),
        (_req, res) => {
          res.sendStatus(201);
        },
      );
      const errors: ErrorRequestHandler = (_err, _req, res, _next) => {
        void _next;
        res.sendStatus(400);
      };
      app.use(errors);
      const source = await photo();
      await request(app)
        .post('/')
        .attach('archivos', source, 'photo.jpg')
        .attach('archivos', Buffer.from('fake'), 'fake.pdf')
        .expect(400);
      expect(await readdir(directory)).toEqual([]);
      await request(app)
        .post('/')
        .attach('archivos', source, 'photo.jpg')
        .expect(201);
      const files = await readdir(directory);
      expect(files).toHaveLength(1);
      expect(
        (await sharp(await readFile(join(directory, files[0]))).metadata())
          .exif,
      ).toBeUndefined();
      await request(app)
        .post('/')
        .attach('archivos', Buffer.alloc(1024 * 1024 + 1), 'large.jpg')
        .expect(400);
      expect(await readdir(directory)).toEqual(files);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
