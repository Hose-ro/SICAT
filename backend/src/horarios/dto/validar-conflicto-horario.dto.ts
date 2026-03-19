import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';
import { BaseHorarioDto } from './base-horario.dto';

export class ValidarConflictoHorarioDto extends BaseHorarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  horarioId?: number;
}
