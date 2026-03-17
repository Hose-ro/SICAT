import { IsInt, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoAsistencia } from '@prisma/client';

export class RegistroAsistenciaDto {
  @IsInt()
  alumnoId: number;

  @IsEnum(EstadoAsistencia)
  estado: EstadoAsistencia;
}

export class PasarListaDto {
  @IsInt()
  claseSesionId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegistroAsistenciaDto)
  registros: RegistroAsistenciaDto[];
}
