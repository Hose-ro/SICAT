import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { HorarioVisionService } from './horario-vision.service';
import {
  HORARIO_VISION_ERROR,
  HorarioVisionError,
} from './horario-vision.error';

const CONTEXTO = {
  periodo: '2026-B',
  semestre: 3,
  seccion: 'A',
  carrera: 'Ingeniería en Sistemas Computacionales',
  reticula: [{ clave: 'ACF-0904', nombre: 'Cálculo Vectorial' }],
  docentes: [{ nombre: 'Fernando Alvarez Hernandez' }],
};

describe('HorarioVisionService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('explica cuando falta configurar el lector', async () => {
    const service = new HorarioVisionService(new ConfigService({}));

    expect(service.estadoConfiguracion()).toMatchObject({
      configurado: false,
      modelo: 'gpt-5.6-sol',
    });
    await expect(
      service.extraer(Buffer.from('no se procesa'), 'image/jpeg', CONTEXTO),
    ).rejects.toMatchObject<Partial<HorarioVisionError>>({
      code: HORARIO_VISION_ERROR.NO_CONFIGURADO,
    });
  });

  it('envía original y acercamiento con detalle original', async () => {
    const service = new HorarioVisionService(
      new ConfigService({ OPENAI_API_KEY: 'test-key' }),
    );
    const imagen = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: '#eeeeee',
      },
    })
      .jpeg()
      .toBuffer();
    const horario = {
      periodoDetectado: '2026-B',
      semestreDetectado: 3,
      seccionDetectada: 'A',
      confianzaGeneral: 0.91,
      bloques: [
        {
          clave: 'ACF-0904',
          materia: 'Cálculo Vectorial',
          docente: 'Fernando Alvarez Hernandez',
          aula: 'S 20',
          dia: 'Lunes',
          horaInicio: '14:00',
          horaFin: '15:00',
          confianza: 0.9,
        },
      ],
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              content: [{ type: 'output_text', text: JSON.stringify(horario) }],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      service.extraer(imagen, 'image/jpeg', CONTEXTO),
    ).resolves.toEqual(horario);

    const request = fetchMock.mock.calls[0][1];
    if (typeof request?.body !== 'string') {
      throw new Error('La solicitud de prueba no contiene JSON');
    }
    const body = JSON.parse(request.body) as {
      reasoning: { effort: string };
      input: Array<{
        content: Array<{ type: string; detail?: string }>;
      }>;
    };
    const images = body.input[0].content.filter(
      (item) => item.type === 'input_image',
    );
    expect(body.reasoning.effort).toBe('medium');
    expect(images).toHaveLength(2);
    expect(images.every((item) => item.detail === 'original')).toBe(true);
  });

  it('clasifica una credencial rechazada por el proveedor', async () => {
    const service = new HorarioVisionService(
      new ConfigService({ OPENAI_API_KEY: 'test-key' }),
    );
    const imagen = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: '#eeeeee',
      },
    })
      .jpeg()
      .toBuffer();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid key' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      service.extraer(imagen, 'image/jpeg', CONTEXTO),
    ).rejects.toMatchObject<Partial<HorarioVisionError>>({
      code: HORARIO_VISION_ERROR.CREDENCIALES,
    });
  });
});
