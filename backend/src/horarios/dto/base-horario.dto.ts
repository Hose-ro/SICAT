import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';

function normalizarDiasEntrada(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export class BaseHorarioDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  materiaId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  docenteId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  aulaId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  grupoId?: number;

  @ApiProperty({ type: [String], example: ['Lunes', 'Miercoles'] })
  @Transform(({ value }) => normalizarDiasEntrada(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  dias: string[];

  @ApiProperty({ example: '07:00' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaInicio: string;

  @ApiProperty({ example: '09:00' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaFin: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semestre?: number;
}
