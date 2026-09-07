import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarUnidadesDto {
  @ApiProperty({ example: 4, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  numUnidades: number;

  /**
   * Reducir unidades borra lo que tengan registrado. Sin esta bandera el
   * servicio responde 409 con el resumen de lo que se perdería.
   */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  forzar?: boolean;
}
