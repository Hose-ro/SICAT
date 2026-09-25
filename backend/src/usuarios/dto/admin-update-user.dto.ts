import * as V from 'class-validator';
import { toNumber, ToNumber } from '../../common/validation/transforms';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Rol, Sexo } from '@prisma/client';
import {
  normalizeControlNumber,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeUsername,
  transformString,
} from '../../common/identity-normalization';

/**
 * Los campos opcionales del usuario aceptan `null` (o cadena vacía) para
 * limpiarlos; omitirlos deja el valor actual sin cambios.
 */
const nullableString = (
  value: unknown,
  normalizer: (input: string) => string,
): unknown => {
  if (value === null || value === '') return null;
  return transformString(value, normalizer);
};

const nullableInt = (value: unknown): unknown => {
  if (value === null || value === '') return null;
  return toNumber(value);
};

export class AdminUpdateUserDto {
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }) => transformString(value as unknown, normalizeName))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => nullableString(value as unknown, normalizeEmail))
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @V.MaxLength(200)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    nullableString(value as unknown, normalizeControlNumber),
  )
  @IsString()
  @Matches(/^\d{3}[A-Za-z]\d{4}$/, {
    message: 'El número de control debe tener el formato 225Q0103',
  })
  numeroControl?: string | null;

  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => nullableString(value as unknown, normalizeUsername))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  username?: string | null;

  @V.MaxLength(200)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => nullableString(value as unknown, normalizePhone))
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'El teléfono debe contener 10 dígitos',
  })
  telefono?: string | null;

  @ApiPropertyOptional({ enum: Sexo, nullable: true })
  @IsOptional()
  @IsEnum(Sexo)
  sexo?: Sexo | null;

  @V.IsByteLength(0, 72)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({ enum: Rol })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(Rol)
  rol?: Rol;

  @V.Max(2147483647)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => nullableInt(value as unknown))
  @IsInt()
  @Min(1)
  carreraId?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 12, nullable: true })
  @IsOptional()
  @Transform(({ value }) => nullableInt(value as unknown))
  @IsInt()
  @Min(1)
  @Max(12)
  semestre?: number | null;

  @V.Max(2147483647)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => nullableInt(value as unknown))
  @IsInt()
  @Min(1)
  academiaId?: number | null;

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

  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  activo?: boolean;
}
