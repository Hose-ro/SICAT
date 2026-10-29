import * as V from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SanitizeText,
  ToNumber,
  toBoolean,
} from '../../common/validation/transforms';

export class CapturaAlumnoDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  alumnoId: number;

  // Sin el campo no se toca la calificación; null la quita.
  @V.ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @ToNumber()
  @IsNumber()
  @Min(1)
  @Max(100)
  calificacion?: number | null;

  // "No presentó": se guarda como no entregada con 0.
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  @IsBoolean()
  noPresento?: boolean;

  @V.MaxLength(5000)
  @V.ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @SanitizeText()
  @IsString()
  observacion?: string | null;
}

export class CapturarCalificacionesDto {
  @V.ArrayMinSize(1)
  @V.ArrayMaxSize(200)
  @V.ArrayUnique((item: CapturaAlumnoDto) => item?.alumnoId)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CapturaAlumnoDto)
  calificaciones: CapturaAlumnoDto[];
}
