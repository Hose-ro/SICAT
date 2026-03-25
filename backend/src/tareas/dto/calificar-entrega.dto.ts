import { Type } from 'class-transformer';
import { TipoCalificacion } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
} from 'class-validator';

export class CalificarEntregaDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  calificacion?: number;

  @IsEnum(TipoCalificacion)
  calificacionTipo: TipoCalificacion;

  @IsOptional()
  @IsString()
  observacion?: string;
}
