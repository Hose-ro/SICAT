import * as V from 'class-validator';
import { Transform } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';
import {
  SanitizeText,
  toBoolean,
  ToNumber,
} from '../../common/validation/transforms';

export class CrearAvisoDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  materiaId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  grupoId: number;

  // Con alumno, el aviso es sólo para él.
  @V.Min(1)
  @V.Max(2147483647)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  alumnoId?: number;

  @V.Matches(/\S/, { message: 'Escribe un título' })
  @V.MaxLength(120)
  @SanitizeText()
  @IsString()
  titulo: string;

  @V.Matches(/\S/, { message: 'Escribe el aviso' })
  @V.MaxLength(2000)
  @SanitizeText()
  @IsString()
  cuerpo: string;

  @V.IsBoolean()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  fijado?: boolean;
}

export class EditarAvisoDto {
  @V.Matches(/\S/, { message: 'Escribe un título' })
  @V.MaxLength(120)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  titulo?: string;

  @V.Matches(/\S/, { message: 'Escribe el aviso' })
  @V.MaxLength(2000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  cuerpo?: string;

  @V.IsBoolean()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  fijado?: boolean;
}

export class GuardarWhatsappDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  materiaId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  grupoId: number;

  // Vacío quita el enlace guardado.
  @V.MaxLength(300)
  @IsString()
  enlace: string;
}
