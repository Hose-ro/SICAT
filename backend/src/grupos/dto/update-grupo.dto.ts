import {
  IsString,
  IsOptional,
  IsNotEmpty,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGrupoDto {
  @ApiPropertyOptional({ example: '103A' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9][A-Z0-9 -]*$/i, {
    message: 'El nombre del grupo sólo admite letras, números, espacios y guiones',
  })
  nombre?: string;

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
