import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import {
  HORARIO_VISION_ERROR,
  HorarioVisionError,
} from './horario-vision.error';

type VisionContext = {
  periodo: string;
  semestre: number;
  seccion: string;
  carrera: string;
  reticula: Array<{ clave: string; nombre: string }>;
  docentes: Array<{ nombre: string }>;
};

export type HorarioDetectado = {
  periodoDetectado: string;
  semestreDetectado: number | null;
  seccionDetectada: string;
  confianzaGeneral: number;
  bloques: Array<{
    clave: string;
    materia: string;
    docente: string;
    aula: string;
    dia: string;
    horaInicio: string;
    horaFin: string;
    confianza: number;
  }>;
};

type OpenAIResponsePayload = {
  error?: { message?: string };
  status?: string;
  incomplete_details?: unknown;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

@Injectable()
export class HorarioVisionService {
  private readonly logger = new Logger(HorarioVisionService.name);

  constructor(private readonly config: ConfigService) {}

  estadoConfiguracion() {
    const configurado = Boolean(
      this.config.get<string>('OPENAI_API_KEY')?.trim(),
    );
    return {
      configurado,
      modelo:
        this.config.get<string>('OPENAI_VISION_MODEL')?.trim() || 'gpt-5.6-sol',
      mensaje: configurado
        ? 'El lector automático está disponible.'
        : 'Falta configurar OPENAI_API_KEY en el backend.',
    };
  }

  async extraer(
    imagen: Buffer,
    mimeType: string,
    context: VisionContext,
  ): Promise<HorarioDetectado> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn(
        'Lectura automática de horarios deshabilitada: falta OPENAI_API_KEY',
      );
      throw new HorarioVisionError(
        HORARIO_VISION_ERROR.NO_CONFIGURADO,
        'El lector automático no está configurado en el servidor.',
      );
    }

    const model =
      this.config.get<string>('OPENAI_VISION_MODEL')?.trim() || 'gpt-5.6-sol';
    const [imagenOrientada, acercamiento] = await this.prepararImagen(imagen);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    const catalogo = JSON.stringify(
      {
        carrera: context.carrera,
        periodoEsperado: context.periodo,
        semestreEsperado: context.semestre,
        seccionEsperada: context.seccion,
        materiasPosibles: context.reticula,
        docentesRegistrados: context.docentes,
      },
      null,
      2,
    );

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          store: false,
          reasoning: { effort: 'medium' },
          instructions:
            'Extrae únicamente el horario académico de esta carga escolar. Recibirás la fotografía completa y un acercamiento de alto contraste de la misma tabla. Ignora y no devuelvas nombre del alumno, número de control, retrato, firmas u otros datos personales. La tabla usa una fila por materia: el nombre de la materia aparece arriba y el docente debajo; en cada columna de día aparece la hora arriba y el aula debajo. Devuelve un bloque separado por cada combinación de materia, día e intervalo, aunque una materia se repita varios días. Usa las claves y nombres del catálogo cuando la evidencia lo permita. Conserva el nombre visible del docente aunque no exista en el catálogo. No inventes celdas vacías.',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `Contexto académico para resolver abreviaciones:\n${catalogo}`,
                },
                {
                  type: 'input_image',
                  image_url: `data:${mimeType};base64,${imagenOrientada.toString('base64')}`,
                  detail: 'original',
                },
                {
                  type: 'input_image',
                  image_url: `data:image/jpeg;base64,${acercamiento.toString('base64')}`,
                  detail: 'original',
                },
              ],
            },
          ],
          text: {
            verbosity: 'low',
            format: {
              type: 'json_schema',
              name: 'horario_academico',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  periodoDetectado: { type: 'string' },
                  semestreDetectado: { type: ['integer', 'null'] },
                  seccionDetectada: { type: 'string' },
                  confianzaGeneral: { type: 'number', minimum: 0, maximum: 1 },
                  bloques: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        clave: { type: 'string' },
                        materia: { type: 'string' },
                        docente: { type: 'string' },
                        aula: { type: 'string' },
                        dia: {
                          type: 'string',
                          enum: [
                            'Lunes',
                            'Martes',
                            'Miercoles',
                            'Jueves',
                            'Viernes',
                            'Sabado',
                          ],
                        },
                        horaInicio: {
                          type: 'string',
                          pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
                        },
                        horaFin: {
                          type: 'string',
                          pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
                        },
                        confianza: { type: 'number', minimum: 0, maximum: 1 },
                      },
                      required: [
                        'clave',
                        'materia',
                        'docente',
                        'aula',
                        'dia',
                        'horaInicio',
                        'horaFin',
                        'confianza',
                      ],
                    },
                  },
                },
                required: [
                  'periodoDetectado',
                  'semestreDetectado',
                  'seccionDetectada',
                  'confianzaGeneral',
                  'bloques',
                ],
              },
            },
          },
        }),
      });

      const payload = (await response.json()) as OpenAIResponsePayload;
      if (!response.ok) {
        const providerMessage = payload.error?.message || 'sin detalle';
        this.logger.error(
          `El proveedor de lectura de horarios respondió ${response.status}: ${providerMessage}`,
        );
        throw this.errorProveedor(response.status, providerMessage);
      }
      const outputText = (payload.output ?? [])
        .flatMap((item) => item.content ?? [])
        .find((item) => item.type === 'output_text')?.text;
      if (!outputText) {
        this.logger.error(
          'El proveedor de lectura de horarios no devolvió contenido estructurado',
        );
        throw new HorarioVisionError(
          HORARIO_VISION_ERROR.RESPUESTA,
          'El lector no devolvió un horario estructurado.',
        );
      }
      try {
        const parsed: unknown = JSON.parse(outputText);
        return this.validarResultado(parsed);
      } catch (error: unknown) {
        if (error instanceof HorarioVisionError) throw error;
        throw new HorarioVisionError(
          HORARIO_VISION_ERROR.RESPUESTA,
          'El lector devolvió una respuesta que no pudo interpretarse.',
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error(
          'La lectura automática del horario excedió el tiempo límite',
        );
        throw new HorarioVisionError(
          HORARIO_VISION_ERROR.TIEMPO,
          'La lectura automática tardó demasiado. Intenta reprocesarla.',
        );
      }
      if (error instanceof HorarioVisionError) throw error;
      this.logger.error(
        'Falló la lectura automática del horario',
        error instanceof Error ? error.stack : undefined,
      );
      throw new HorarioVisionError(
        HORARIO_VISION_ERROR.PROVEEDOR,
        'El lector automático no está disponible temporalmente.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async prepararImagen(imagen: Buffer) {
    try {
      const orientada = await sharp(imagen, { failOn: 'none' })
        .autoOrient()
        .toBuffer({ resolveWithObject: true });
      const left = Math.floor(orientada.info.width * 0.04);
      const top = Math.floor(orientada.info.height * 0.14);
      const width = Math.max(1, Math.floor(orientada.info.width * 0.92));
      const height = Math.max(1, Math.floor(orientada.info.height * 0.58));
      const targetWidth = Math.min(3200, Math.max(2400, width));
      const acercamiento = await sharp(orientada.data)
        .extract({ left, top, width, height })
        .resize({ width: targetWidth, withoutEnlargement: false })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1 })
        .jpeg({ quality: 94 })
        .toBuffer();
      return [orientada.data, acercamiento] as const;
    } catch (error: unknown) {
      this.logger.error(
        'No se pudo preparar la fotografía del horario',
        error instanceof Error ? error.stack : undefined,
      );
      throw new HorarioVisionError(
        HORARIO_VISION_ERROR.IMAGEN,
        'La fotografía no tiene un formato de imagen válido.',
      );
    }
  }

  private errorProveedor(status: number, message: string) {
    if (status === 401 || status === 403) {
      return new HorarioVisionError(
        HORARIO_VISION_ERROR.CREDENCIALES,
        'La credencial del lector automático no es válida.',
      );
    }
    if (status === 429) {
      return new HorarioVisionError(
        HORARIO_VISION_ERROR.LIMITE,
        'El lector alcanzó su límite temporal. Intenta nuevamente más tarde.',
      );
    }
    if (status === 400 && /model/i.test(message)) {
      return new HorarioVisionError(
        HORARIO_VISION_ERROR.MODELO,
        'El modelo configurado para leer horarios no está disponible.',
      );
    }
    return new HorarioVisionError(
      HORARIO_VISION_ERROR.PROVEEDOR,
      'El lector automático no está disponible temporalmente.',
    );
  }

  private validarResultado(value: unknown): HorarioDetectado {
    if (
      !value ||
      typeof value !== 'object' ||
      !Array.isArray((value as { bloques?: unknown }).bloques)
    ) {
      throw new HorarioVisionError(
        HORARIO_VISION_ERROR.RESPUESTA,
        'El lector no devolvió una lista de bloques válida.',
      );
    }
    return value as HorarioDetectado;
  }
}
