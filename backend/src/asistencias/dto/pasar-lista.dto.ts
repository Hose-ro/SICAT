import {
  IsInt,
  IsArray,
  ValidateNested,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoAsistencia } from '@prisma/client';

export class RegistroAsistenciaDto {
  @IsInt()
  alumnoId: number;

  @IsEnum(EstadoAsistencia)
  estado: EstadoAsistencia;

  @IsOptional()
  @IsString()
  observacion?: string;
}

export class PasarListaDto {
  @IsInt()
  claseSesionId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegistroAsistenciaDto)
  registros: RegistroAsistenciaDto[];
}
