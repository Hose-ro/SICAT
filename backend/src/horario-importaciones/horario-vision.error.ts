export const HORARIO_VISION_ERROR = {
  NO_CONFIGURADO: 'LECTOR_NO_CONFIGURADO',
  CREDENCIALES: 'LECTOR_CREDENCIALES_INVALIDAS',
  LIMITE: 'LECTOR_LIMITE_ALCANZADO',
  MODELO: 'LECTOR_MODELO_NO_DISPONIBLE',
  TIEMPO: 'LECTOR_TIEMPO_AGOTADO',
  IMAGEN: 'LECTOR_IMAGEN_INVALIDA',
  RESPUESTA: 'LECTOR_RESPUESTA_INVALIDA',
  SIN_BLOQUES: 'LECTOR_SIN_BLOQUES',
  PROVEEDOR: 'LECTOR_NO_DISPONIBLE',
} as const;

export type HorarioVisionErrorCode =
  (typeof HORARIO_VISION_ERROR)[keyof typeof HORARIO_VISION_ERROR];

export class HorarioVisionError extends Error {
  constructor(
    readonly code: HorarioVisionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HorarioVisionError';
  }
}
