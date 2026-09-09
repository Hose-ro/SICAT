import * as V from 'class-validator';
import { toBoolean, SanitizeText } from '../../common/validation/transforms';
import { ToNumber } from '../../common/validation/transforms';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstadoTarea, TipoEntrega, TipoEvaluacion } from '@prisma/client';

export class CrearTareaDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  materiaId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  grupoId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  unidadId?: number;

  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @SanitizeText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  titulo: string;

  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @SanitizeText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  instrucciones: string;

  @IsEnum(TipoEntrega)
  tipoEntrega: TipoEntrega;

  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(TipoEvaluacion)
  tipoEvaluacion?: TipoEvaluacion;

  @V.IsBoolean()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  permiteReenvio?: boolean;

  @V.IsBoolean()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  tieneFechaLimite?: boolean;

  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString({ strict: true, strictSeparator: true })
  fechaLimite?: string;

  @V.MaxLength(200)
  @V.Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  horaLimite?: string;

  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(EstadoTarea)
  estado?: EstadoTarea;

  @V.MaxLength(100000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  rubricJson?: string;

  @V.MaxLength(6000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  removerArchivoIds?: string;
}
