import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class ActualizarUnidadesDto {
  @ApiProperty({ example: 4, minimum: 1, maximum: 12 })
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(12)
  numUnidades: number;

  /**
   * Reducir unidades borra lo que tengan registrado. Sin esta bandera el
   * servicio responde 409 con el resumen de lo que se perdería.
   */
  @ApiPropertyOptional({ default: false })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  forzar?: boolean;
}
