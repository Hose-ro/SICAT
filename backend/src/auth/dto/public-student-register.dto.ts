import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
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
import {
  normalizeControlNumber,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  transformString,
} from '../../common/identity-normalization';

export class PublicStudentRegisterDto {
  @ApiProperty()
  @Transform(({ value }) => transformString(value as unknown, normalizeName))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

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
  @IsOptional()
  @Transform(({ value }) => transformString(value as unknown, normalizeEmail))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => transformString(value as unknown, normalizePhone))
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'El teléfono debe contener 10 dígitos',
  })
  telefono?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carreraId: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semestre: number;

  @ApiPropertyOptional({ example: '2026-A' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-[AB]$/, {
    message: 'El periodo debe tener el formato 2026-A',
  })
  periodo?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]$/, {
    message: 'La sección debe ser una letra de A a Z',
  })
  seccion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  usarHorarioExistente?: boolean;
}
