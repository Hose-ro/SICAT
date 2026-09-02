import { Transform, Type } from 'class-transformer';
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
import { Rol } from '@prisma/client';
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
  return value === undefined ? undefined : Number(value);
};

export class AdminUpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => nullableString(value as unknown, normalizeUsername))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  username?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => nullableString(value as unknown, normalizePhone))
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'El teléfono debe contener 10 dígitos',
  })
  telefono?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({ enum: Rol })
  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => nullableInt(value as unknown))
  @IsInt()
  @Min(1)
  academiaId?: number | null;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  carreraIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
