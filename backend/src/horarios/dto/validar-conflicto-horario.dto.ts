import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { BaseHorarioDto } from './base-horario.dto';

export class ValidarConflictoHorarioDto extends BaseHorarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  horarioId?: number;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'Bloques de la clase que se está editando, para excluirlos del choque consigo misma',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  horarioIds?: number[];
}
