import * as V from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  NUMERO_CONTROL_MENSAJE,
  NUMERO_CONTROL_PATRON,
} from '../../common/identity-normalization';

/**
 * Alta de un alumno directamente en el grupo del docente. La carrera y el
 * semestre no se piden: son los del grupo.
 */
export class CrearAlumnoGrupoDto {
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty({ example: 'Ana López' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @V.MaxLength(200)
  @ApiProperty({ example: '225Q0103' })
  @IsString()
  @Matches(NUMERO_CONTROL_PATRON, { message: NUMERO_CONTROL_MENSAJE })
  numeroControl: string;

  @V.IsByteLength(0, 72)
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

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
}
