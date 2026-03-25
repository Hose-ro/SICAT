import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstadoTarea, TipoEntrega, TipoEvaluacion } from '@prisma/client';

const toBoolean = ({ value }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string')
    return ['true', '1', 'on', 'yes'].includes(value.toLowerCase());
  return false;
};

export class CrearTareaDto {
  @Type(() => Number)
  @IsInt()
  materiaId: number;

  @Type(() => Number)
  @IsInt()
  grupoId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  unidadId?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  titulo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  instrucciones: string;

  @IsEnum(TipoEntrega)
  tipoEntrega: TipoEntrega;

  @IsOptional()
  @IsEnum(TipoEvaluacion)
  tipoEvaluacion?: TipoEvaluacion;

  @IsOptional()
  @Transform(toBoolean)
  permiteReenvio?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  tieneFechaLimite?: boolean;

  @IsOptional()
  @IsDateString()
  fechaLimite?: string;

  @IsOptional()
  @IsString()
  horaLimite?: string;

  @IsOptional()
  @IsEnum(EstadoTarea)
  estado?: EstadoTarea;

  @IsOptional()
  @IsString()
  rubricJson?: string;

  @IsOptional()
  @IsString()
  removerArchivoIds?: string;
}
