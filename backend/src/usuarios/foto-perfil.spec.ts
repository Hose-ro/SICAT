import express from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import multer from 'multer';
import request from 'supertest';
import sharp from 'sharp';
import { ConfigService } from '@nestjs/config';
import { fotoPerfilUploadOptions, procesarFotoPerfil } from './foto-perfil';
import { UsuariosService } from './usuarios.service';
import type { AuthenticatedUser } from '../auth/auth.types';

function imagen(width = 800, height = 600, format: 'jpeg' | 'png' = 'jpeg') {
  return sharp({
    create: { width, height, channels: 3, background: 'teal' },
  })
    .toFormat(format)
    .withExifMerge({
      IFD0: { Make: 'Private device' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '19/1 25/1 0/1' },
    })
    .toBuffer();
}

describe('foto de perfil', () => {
  function app() {
    const handler = jest.fn((req: Request, res: Response) =>
      res.json({ mime: req.file?.mimetype }),
    );
    const server = express();
    server.post('/', multer(fotoPerfilUploadOptions).single('foto'), handler);
    const errors: ErrorRequestHandler = (_err, _req, res, _next) => {
      void _next;
      res.sendStatus(400);
    };
    server.use(errors);
    return { server, handler };
  }

  it('rechaza SVG, GIF y archivos disfrazados de imagen', async () => {
    const { server, handler } = app();
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await request(server)
      .post('/')
      .attach('foto', svg, { filename: 'a.svg', contentType: 'image/svg+xml' })
      .expect(400);
    await request(server)
      .post('/')
      .attach('foto', svg, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(400);
    await request(server)
      .post('/')
      .attach('foto', Buffer.from('GIF89a'), {
        filename: 'a.gif',
        contentType: 'image/gif',
      })
      .expect(400);
    // PNG real con extensión .jpg: el contenido no coincide.
    await request(server)
      .post('/')
      .attach('foto', await imagen(100, 100, 'png'), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect(handler).not.toHaveBeenCalled();
    await request(server)
      .post('/')
      .attach('foto', await imagen(), {
        filename: 'foto.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);
  });

  it('rechaza archivos de más de 5 MB y campos extra', async () => {
    const { server, handler } = app();
    await request(server)
      .post('/')
      .attach('foto', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'grande.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    await request(server)
      .post('/')
      .field('otro', 'x')
      .attach('foto', await imagen(), {
        filename: 'foto.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('guarda una WebP cuadrada de 512 sin metadatos', async () => {
    const { contenido, mime, huella } = await procesarFotoPerfil(
      await imagen(),
    );
    const meta = await sharp(contenido).metadata();
    expect(mime).toBe('image/webp');
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });
    expect(meta.exif).toBeUndefined();
    expect(contenido.includes('Private device')).toBe(false);
    expect(huella).toMatch(/^[0-9a-f]{16}$/);
  });

  it('rechaza fotos diminutas o dañadas', async () => {
    await expect(procesarFotoPerfil(await imagen(40, 40))).rejects.toThrow(
      'muy pequeña',
    );
    const rota = (await imagen()).subarray(0, 200);
    await expect(procesarFotoPerfil(rota)).rejects.toThrow('JPG, PNG o WebP');
  });

  describe('quién puede ver la foto', () => {
    function servicio(rolDueno: string) {
      const prisma = {
        fotoPerfil: {
          findUnique: jest.fn().mockResolvedValue({
            mime: 'image/webp',
            contenido: new Uint8Array([1, 2, 3]),
            usuario: { rol: rolDueno, avatar: 'abc' },
          }),
        },
      };
      return new UsuariosService(
        prisma as never,
        { get: jest.fn() } as unknown as ConfigService,
      );
    }
    const quien = (id: number, rol: string) =>
      ({ id, rol }) as unknown as AuthenticatedUser;

    it('un alumno no ve la foto de otro alumno', async () => {
      await expect(
        servicio('ALUMNO').leerFotoPerfil(quien(1, 'ALUMNO'), 2),
      ).rejects.toThrow('Sin foto');
    });

    it('el alumno ve la suya y la de su docente; el personal ve todas', async () => {
      await expect(
        servicio('ALUMNO').leerFotoPerfil(quien(2, 'ALUMNO'), 2),
      ).resolves.toMatchObject({ huella: 'abc' });
      await expect(
        servicio('DOCENTE').leerFotoPerfil(quien(1, 'ALUMNO'), 9),
      ).resolves.toMatchObject({ mime: 'image/webp' });
      await expect(
        servicio('ALUMNO').leerFotoPerfil(quien(9, 'DOCENTE'), 2),
      ).resolves.toMatchObject({ huella: 'abc' });
    });
  });
});
