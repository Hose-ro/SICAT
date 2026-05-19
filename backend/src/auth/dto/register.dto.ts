import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rol } from '@prisma/client';

export class RegisterDto {
  @ApiProperty() @IsNotEmpty() @IsString() nombre: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeroControl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() username?: string;
  // Optional when registering via Google (backend generates a random password)
  @ApiPropertyOptional() @IsOptional() @MinLength(6) password?: string;
  @ApiProperty({ enum: Rol }) @IsEnum(Rol) rol: Rol;
  @ApiPropertyOptional() @IsOptional() @IsInt() academiaId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() telefono?: string;
  @ApiPropertyOptional() @IsOptional() carreraId?: number;
  @ApiPropertyOptional() @IsOptional() semestre?: number;
  // Token firmado generado por el backend al autenticar con Google
  @ApiPropertyOptional() @IsOptional() @IsString() pendingGoogleToken?: string;
}
