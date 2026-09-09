import * as V from 'class-validator';
import { ToNumber, SanitizeText } from '../../common/validation/transforms';

import {
  IsInt,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class GuardarCalificacionManualDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  alumnoId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  materiaId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  unidadId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  grupoId?: number;

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
