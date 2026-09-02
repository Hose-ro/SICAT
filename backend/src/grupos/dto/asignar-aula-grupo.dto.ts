import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AsignarAulaGrupoDto {
  @ApiProperty({
    example: 3,
    nullable: true,
    description: 'Aula a asignar. Envía null para quitar el aula.',
  })
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  aulaId: number | null;

  @ApiPropertyOptional({
    example: 12,
    description:
      'Bloque de horario específico. Si se omite, el aula se aplica a todas las clases del grupo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  horarioId?: number;
}
