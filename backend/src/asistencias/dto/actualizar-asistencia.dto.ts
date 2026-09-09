import * as V from 'class-validator';
import { EstadoAsistencia } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';
import { SanitizeText } from '../../common/validation/transforms';

export class ActualizarAsistenciaDto {
  @IsEnum(EstadoAsistencia)
  estado: EstadoAsistencia;

  @V.MaxLength(5000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  observacion?: string;
}
