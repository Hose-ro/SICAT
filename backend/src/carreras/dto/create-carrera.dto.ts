import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function trimText({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class CreateCarreraDto {
  @ApiProperty({ example: 'Ingeniería en Sistemas Computacionales' })
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiProperty({ example: 'ISC' })
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, {
    message:
      'El código sólo puede contener letras, números, puntos, guiones y guion bajo',
  })
  codigo: string;

  @ApiPropertyOptional({ example: 'ISIC-2010-224' })
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  planEstudios?: string;
}
