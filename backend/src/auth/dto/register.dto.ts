import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
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
import { Rol, Sexo } from '@prisma/client';
import {
  normalizeControlNumber,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeUsername,
  transformString,
} from '../../common/identity-normalization';

export class RegisterDto {
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty()
  @Transform(({ value }) => transformString(value as unknown, normalizeName))
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }) => transformString(value as unknown, normalizeEmail))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }) =>
    transformString(value as unknown, normalizeControlNumber),
  )
  @Matches(/^\d{3}[A-Za-z]\d{4}$/, {
    message: 'El número de control debe tener el formato 225Q0103',
  })
  numeroControl?: string;

  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }) =>
    transformString(value as unknown, normalizeUsername),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  username?: string;

  @V.IsByteLength(0, 72)
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ enum: Rol })
  @IsEnum(Rol)
  rol: Rol;

  @V.Max(2147483647)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  @Min(1)
  academiaId?: number;

  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }) => transformString(value as unknown, normalizePhone))
  @Matches(/^\d{10}$/, {
    message: 'El teléfono debe contener 10 dígitos',
  })
  telefono?: string;

  @V.Max(2147483647)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  @Min(1)
  carreraId?: number;

  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(500)
  @ApiPropertyOptional({ type: [Number] })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ToNumber()
  @IsInt({ each: true })
  @Min(1, { each: true })
  carreraIds?: number[];

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(12)
  semestre?: number;

  @ApiPropertyOptional({ enum: Sexo })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(Sexo)
  sexo?: Sexo;
}
