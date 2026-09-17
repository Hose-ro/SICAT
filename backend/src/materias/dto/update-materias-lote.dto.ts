import * as V from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';

/**
 * Cambios que tiene sentido aplicar a varias materias a la vez. Nombre, clave
 * y descripción son propios de cada materia, así que se editan una por una.
 */
export class UpdateMateriasLoteDto {
  @V.Min(1, { each: true })
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(100)
  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ToNumber()
  @IsInt({ each: true })
  materiaIds: number[];

  @V.Min(1)
  @V.Max(2147483647)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  carreraId?: number | null;

  @V.Max(12)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  semestre?: number | null;
}
