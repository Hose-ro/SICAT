import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { ArrayMinSize, IsArray, IsInt, IsPositive } from 'class-validator';
import { BaseHorarioDto } from './base-horario.dto';

export class ValidarConflictoHorarioDto extends BaseHorarioDto {
  @V.Max(2147483647)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  @IsPositive()
  horarioId?: number;

  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(500)
  @V.ArrayUnique()
  @ApiPropertyOptional({
    type: [Number],
    description:
      'Bloques de la clase que se está editando, para excluirlos del choque consigo misma',
  })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ToNumber()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  horarioIds?: number[];
}
