import * as V from 'class-validator';
import { ToNumber, SanitizeText } from '../../common/validation/transforms';

import { TipoCalificacion } from '@prisma/client';
import { IsEnum, IsNumber, Min, Max, IsString } from 'class-validator';

export class CalificarEntregaDto {
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsNumber()
  @Min(1)
  @Max(100)
  calificacion?: number;

  @IsEnum(TipoCalificacion)
  calificacionTipo: TipoCalificacion;

  @V.MaxLength(5000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  observacion?: string;
}
