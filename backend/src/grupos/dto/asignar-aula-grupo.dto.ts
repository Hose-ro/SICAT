import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';

import { IsInt, IsPositive, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AsignarAulaGrupoDto {
  @V.Max(2147483647)
  @ApiProperty({
    example: 3,
    nullable: true,
    description: 'Aula a asignar. Envía null para quitar el aula.',
  })
  @ValidateIf((_, value) => value !== null)
  @ToNumber()
  @IsInt()
  @IsPositive()
  aulaId: number | null;

  @V.Max(2147483647)
  @ApiPropertyOptional({
    example: 12,
    description:
      'Bloque de horario específico. Si se omite, el aula se aplica a todas las clases del grupo.',
  })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  @IsPositive()
  horarioId?: number;
}
