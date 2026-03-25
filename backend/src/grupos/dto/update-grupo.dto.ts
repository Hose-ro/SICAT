import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGrupoDto {
  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]$/, {
    message: 'La sección debe ser una sola letra mayúscula (A-Z)',
  })
  seccion?: string;

  @ApiPropertyOptional({ example: '2026-B' })
  @IsOptional()
  @IsString()
  periodo?: string;
}
