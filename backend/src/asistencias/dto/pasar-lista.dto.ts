import * as V from 'class-validator';
import {
  IsInt,
  IsArray,
  ValidateNested,
  IsEnum,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoAsistencia } from '@prisma/client';
import { SanitizeText } from '../../common/validation/transforms';

export class RegistroAsistenciaDto {
  @V.Min(1)
  @V.Max(2147483647)
  @IsInt()
  alumnoId: number;

  @IsEnum(EstadoAsistencia)
  estado: EstadoAsistencia;

  @V.MaxLength(5000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  observacion?: string;
}

export class PasarListaDto {
  @V.Min(1)
  @V.Max(2147483647)
  @IsInt()
  claseSesionId: number;

  @V.ArrayMaxSize(500)
  @V.ArrayUnique((registro: RegistroAsistenciaDto) => registro.alumnoId)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegistroAsistenciaDto)
  registros: RegistroAsistenciaDto[];
}
