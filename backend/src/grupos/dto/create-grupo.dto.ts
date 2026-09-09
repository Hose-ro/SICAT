import * as V from 'class-validator';
import {
  IsInt,
  IsString,
  IsNotEmpty,
  Min,
  Max,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGrupoDto {
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty({
    example: '103A',
    description: 'Nombre con el que se conoce al grupo',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9][A-Z0-9 -]*$/i, {
    message:
      'El nombre del grupo sólo admite letras, números, espacios y guiones',
  })
  nombre: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(9)
  semestre: number;

  /**
   * Opcional: si no se envía, se toma de la última letra del nombre o se
   * asigna la primera libre del semestre, carrera y periodo.
   */
  @V.MaxLength(200)
  @ApiPropertyOptional({ example: 'A' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^[A-Z]$/, {
    message: 'La sección debe ser una sola letra mayúscula (A-Z)',
  })
  seccion?: string;

  @V.Min(1)
  @V.Max(2147483647)
  @ApiProperty({ example: 1 })
  @IsInt()
  carreraId: number;

  @V.MaxLength(200)
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @V.Matches(/^\d{4}-[AB]$/)
  @ApiProperty({ example: '2026-A' })
  @IsString()
  @IsNotEmpty()
  periodo: string;
}
