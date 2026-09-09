import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsPositive,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

function normalizarDiasEntrada(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export class HorarioBloqueDto {
  @V.MaxLength(200)
  @ApiProperty({ example: 'Lunes' })
  @IsString()
  dia: string;

  @ApiProperty({ example: '07:00' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaInicio: string;

  @ApiProperty({ example: '09:00' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaFin: string;
}

export class BaseHorarioDto {
  @V.Max(2147483647)
  @ApiProperty()
  @ToNumber()
  @IsInt()
  @IsPositive()
  materiaId: number;

  @V.Max(2147483647)
  @ApiProperty()
  @ToNumber()
  @IsInt()
  @IsPositive()
  docenteId: number;

  @V.Max(2147483647)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  @IsPositive()
  aulaId?: number;

  @V.Max(2147483647)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  @IsPositive()
  grupoId?: number;

  @V.ArrayMaxSize(500)
  @ApiPropertyOptional({ type: [String], example: ['Lunes', 'Miercoles'] })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }) => normalizarDiasEntrada(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  dias?: string[];

  @ApiPropertyOptional({ example: '07:00' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaInicio?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaFin?: string;

  @V.ArrayMaxSize(500)
  @ApiPropertyOptional({ type: [HorarioBloqueDto] })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HorarioBloqueDto)
  bloques?: HorarioBloqueDto[];

  @V.Min(1)
  @V.Max(12)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  semestre?: number;
}
