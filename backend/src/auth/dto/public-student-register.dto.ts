import * as V from 'class-validator';
import { toBoolean } from '../../common/validation/transforms';
import { ToNumber } from '../../common/validation/transforms';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  normalizeControlNumber,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  transformString,
} from '../../common/identity-normalization';

export class PublicStudentRegisterDto {
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty()
  @Transform(({ value }) => transformString(value as unknown, normalizeName))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @V.MaxLength(200)
  @ApiProperty({ example: '225Q0103' })
  @Transform(({ value }) =>
    transformString(value as unknown, normalizeControlNumber),
  )
  @IsString()
  @Matches(/^\d{3}[A-Za-z]\d{4}$/, {
    message: 'El número de control debe tener el formato 225Q0103',
  })
  numeroControl: string;

  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }) => transformString(value as unknown, normalizeEmail))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @V.MaxLength(200)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }) => transformString(value as unknown, normalizePhone))
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'El teléfono debe contener 10 dígitos',
  })
  telefono?: string;

  @V.IsByteLength(0, 72)
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @V.Max(2147483647)
  @ApiProperty()
  @ToNumber()
  @IsInt()
  @Min(1)
  carreraId: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(12)
  semestre: number;

  @V.MaxLength(200)
  @ApiPropertyOptional({ example: '2026-A' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^\d{4}-[AB]$/, {
    message: 'El periodo debe tener el formato 2026-A',
  })
  periodo?: string;

  @V.MaxLength(200)
  @ApiPropertyOptional({ example: 'A' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]$/, {
    message: 'La sección debe ser una letra de A a Z',
  })
  seccion?: string;

  @V.IsBoolean()
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  usarHorarioExistente?: boolean;
}
