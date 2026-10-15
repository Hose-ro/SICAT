import * as V from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ModalidadReunion, TipoReunion } from '@prisma/client';
import {
  SanitizeText,
  toBoolean,
  ToNumber,
} from '../../common/validation/transforms';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const opcional = V.ValidateIf((_object, value: unknown) => value !== undefined);
const anulable = V.ValidateIf(
  (_object, value: unknown) => value !== undefined && value !== null,
);

export class ReunionQueryDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @V.IsInt()
  carreraId: number;
}

/** Campos de la convocatoria comunes a crear y editar. */
class CamposReunionDto {
  @V.MaxLength(2000)
  @anulable
  @SanitizeText()
  @V.IsString()
  asunto?: string | null;

  @V.IsEnum(TipoReunion)
  @opcional
  tipo?: TipoReunion;

  @V.MaxLength(50)
  @anulable
  @SanitizeText()
  @V.IsString()
  numeroActa?: string | null;

  @V.Matches(HORA, {
    message: 'La hora de término debe tener el formato HH:MM',
  })
  @anulable
  horaFin?: string | null;

  @V.IsEnum(ModalidadReunion)
  @opcional
  modalidad?: ModalidadReunion;

  @V.MaxLength(255)
  @anulable
  @SanitizeText()
  @V.IsString()
  lugar?: string | null;

  @V.MaxLength(255)
  @anulable
  @V.IsString()
  enlace?: string | null;

  /** Orden del día, en el orden en que se tratará. */
  @V.MaxLength(1000, { each: true })
  @V.Matches(/\S/, {
    each: true,
    message: 'Un punto del orden del día está vacío',
  })
  @V.ArrayMaxSize(30)
  @opcional
  @V.IsArray()
  @V.IsString({ each: true })
  puntos?: string[];

  /** Docentes convocados. Al crear, si no se manda, se convoca a todos los de la carrera. */
  @V.Min(1, { each: true })
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(300)
  @V.ArrayUnique()
  @opcional
  @V.IsArray()
  @V.IsInt({ each: true })
  convocados?: number[];
}

export class EditarReunionDto extends CamposReunionDto {
  @V.Matches(/\S/, { message: 'Escribe el título de la reunión' })
  @V.MaxLength(200)
  @opcional
  @SanitizeText()
  @V.IsString()
  titulo?: string;

  @V.Matches(FECHA, { message: 'La fecha debe tener el formato AAAA-MM-DD' })
  @opcional
  fecha?: string;

  @V.Matches(HORA, { message: 'La hora de inicio debe tener el formato HH:MM' })
  @opcional
  horaInicio?: string;
}

/** Al crear, `titulo`, `fecha` y `horaInicio` son obligatorios. */
export class CrearReunionDto extends CamposReunionDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @V.IsInt()
  carreraId: number;

  @V.Matches(/\S/, { message: 'Escribe el título de la reunión' })
  @V.MaxLength(200)
  @SanitizeText()
  @V.IsString()
  titulo: string;

  @V.Matches(FECHA, { message: 'La fecha debe tener el formato AAAA-MM-DD' })
  fecha: string;

  @V.Matches(HORA, { message: 'La hora de inicio debe tener el formato HH:MM' })
  horaInicio: string;
}

export class AsistenciaReunionDto {
  @V.Min(1)
  @V.Max(2147483647)
  @V.IsInt()
  docenteId: number;

  @V.IsBoolean()
  asistio: boolean;
}

export class AcuerdoReunionDto {
  @V.Matches(/\S/, { message: 'Un acuerdo está vacío' })
  @V.MaxLength(2000)
  @SanitizeText()
  @V.IsString()
  descripcion: string;

  @V.MaxLength(150)
  @anulable
  @SanitizeText()
  @V.IsString()
  responsable?: string | null;

  @V.Matches(FECHA, {
    message: 'La fecha límite debe tener el formato AAAA-MM-DD',
  })
  @anulable
  fechaLimite?: string | null;
}

/** Acta: asistencia, acuerdos y observaciones. `finalizar` cierra la reunión. */
export class GuardarActaDto {
  @V.ArrayMaxSize(300)
  @opcional
  @V.IsArray()
  @V.ValidateNested({ each: true })
  @Type(() => AsistenciaReunionDto)
  asistencia?: AsistenciaReunionDto[];

  @V.ArrayMaxSize(50)
  @opcional
  @V.IsArray()
  @V.ValidateNested({ each: true })
  @Type(() => AcuerdoReunionDto)
  acuerdos?: AcuerdoReunionDto[];

  @V.MaxLength(5000)
  @anulable
  @SanitizeText()
  @V.IsString()
  observaciones?: string | null;

  @V.IsBoolean()
  @opcional
  @Transform(toBoolean)
  finalizar?: boolean;
}
