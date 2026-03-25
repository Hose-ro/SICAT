import { EstadoAsistencia } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ActualizarAsistenciaDto {
  @IsEnum(EstadoAsistencia)
  estado: EstadoAsistencia;

  @IsOptional()
  @IsString()
  observacion?: string;
}
