import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class GenerarCodigosActivacionDto {
  /** También a quienes ya activaron (les reemplaza el código anterior). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  todos?: boolean;
}
