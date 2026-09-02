import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import {
  normalizeControlNumber,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeUsername,
  transformString,
} from '../../common/identity-normalization';

export class RegisterDto {
  @ApiProperty()
  @Transform(({ value }) => transformString(value as unknown, normalizeName))
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => transformString(value as unknown, normalizeEmail))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    transformString(value as unknown, normalizeControlNumber),
  )
  @Matches(/^\d{3}[A-Za-z]\d{4}$/, {
    message: 'El número de control debe tener el formato 225Q0103',
  })
  numeroControl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    transformString(value as unknown, normalizeUsername),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  username?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ enum: Rol })
  @IsEnum(Rol)
  rol: Rol;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  academiaId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => transformString(value as unknown, normalizePhone))
  @Matches(/^\d{10}$/, {
    message: 'El teléfono debe contener 10 dígitos',
  })
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carreraId?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  carreraIds?: number[];

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semestre?: number;
}
