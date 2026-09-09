import * as V from 'class-validator';
import { EstadoAlertaCarrera } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { SanitizeText } from '../../common/validation/transforms';

export class ActualizarAlertaDto {
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(EstadoAlertaCarrera)
  estado?: EstadoAlertaCarrera;

  @V.MaxLength(5000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  observacion?: string;

  @V.Min(1)
  @V.Max(2147483647)
  @IsOptional()
  @IsInt()
  responsableId?: number | null;

  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  fechaSeguimiento?: string | null;
}
