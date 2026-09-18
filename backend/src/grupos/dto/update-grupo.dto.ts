import * as V from 'class-validator';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ModalidadGrupo } from '@prisma/client';

export class UpdateGrupoDto {
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiPropertyOptional({ example: '103A' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9][A-Z0-9 -]*$/i, {
    message:
      'El nombre del grupo sólo admite letras, números, espacios y guiones',
  })
  nombre?: string;

  @V.MaxLength(200)
  @ApiPropertyOptional({ example: 'B' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^[A-Z]$/, {
    message: 'La sección debe ser una sola letra mayúscula (A-Z)',
  })
  seccion?: string;

  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiPropertyOptional({ example: '2026-B' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40, { message: 'El periodo no puede pasar de 40 caracteres' })
  periodo?: string;

  @ApiPropertyOptional({ enum: ModalidadGrupo })
  @IsOptional()
  @IsEnum(ModalidadGrupo, {
    message: 'La modalidad debe ser ESCOLARIZADO o MIXTO',
  })
  modalidad?: ModalidadGrupo;
}
