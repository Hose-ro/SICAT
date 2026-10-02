import * as V from 'class-validator';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Primer acceso (o recuperación) del alumno con el código de su escuela. */
export class ActivarCuentaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  numeroControl: string;

  @ApiProperty({ example: 'K7P2-M9QX' })
  @IsString()
  @MinLength(8)
  @MaxLength(12)
  codigo: string;

  @V.IsByteLength(0, 72)
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
