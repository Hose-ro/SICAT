import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class InscribirAlumnosDto {
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(500)
  @ApiProperty({ type: [Number], example: [12, 34] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ToNumber()
  @IsInt({ each: true })
  @Min(1, { each: true })
  alumnoIds: number[];

  /** Grupo al que pertenece la clase; deja constancia de a qué lista entra. */
  @V.Max(2147483647)
  @ApiPropertyOptional({ example: 6 })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  @Min(1)
  grupoId?: number;
}
