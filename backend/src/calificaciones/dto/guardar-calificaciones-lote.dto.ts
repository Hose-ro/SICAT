import * as V from 'class-validator';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SanitizeText, ToNumber } from '../../common/validation/transforms';

export class CalificacionLoteItemDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  alumnoId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  unidadId: number;

  @ValidateIf(
    (_, value) => value !== null && value !== undefined && value !== '',
  )
  @ToNumber()
  @IsNumber()
  @Min(1)
  @Max(100)
  calificacionManual?: number | null;

  @V.MaxLength(5000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  observacion?: string;
}

export class GuardarCalificacionesLoteDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  materiaId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  grupoId?: number;

  @V.ArrayMinSize(1)
  @V.ArrayMaxSize(2000)
  @V.ArrayUnique(
    (item: CalificacionLoteItemDto) => `${item.alumnoId}:${item.unidadId}`,
  )
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalificacionLoteItemDto)
  calificaciones: CalificacionLoteItemDto[];
}
