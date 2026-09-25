import * as V from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Sexo } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Completa o corrige los datos de un alumno del grupo (por ejemplo, uno
 * importado sólo con el nombre). Todos los campos son opcionales: el docente
 * llena lo que tenga a la mano en el momento.
 */
export class CompletarAlumnoGrupoDto {
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiPropertyOptional({ example: 'Ana López' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @V.MaxLength(200)
  @ApiPropertyOptional({ example: '225Q0103' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^\d{3}[A-Za-z]\d{4}$/, {
    message: 'El número de control debe tener el formato 225Q0103',
  })
  numeroControl?: string;

  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @V.MaxLength(200)
  @ApiPropertyOptional({ example: '9611234567' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^\d{10}$/, { message: 'El teléfono debe contener 10 dígitos' })
  telefono?: string;

  @V.IsByteLength(0, 72)
  @ApiPropertyOptional({ minLength: 8, maxLength: 72 })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({ enum: Sexo })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(Sexo)
  sexo?: Sexo;
}
