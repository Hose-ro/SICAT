import { EstadoAlertaCarrera } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class ActualizarAlertaDto {
  @IsOptional()
  @IsEnum(EstadoAlertaCarrera)
  estado?: EstadoAlertaCarrera;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsOptional()
  @IsInt()
  responsableId?: number | null;

  @IsOptional()
  @IsDateString()
  fechaSeguimiento?: string | null;
}
