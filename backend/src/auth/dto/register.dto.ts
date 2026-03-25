import {
  IsEmail,
  IsEnum,
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
  @ApiProperty() @MinLength(6) password: string;
  @ApiProperty({ enum: Rol }) @IsEnum(Rol) rol: Rol;
  @ApiPropertyOptional() @IsOptional() @IsString() academia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefono?: string;
  @ApiPropertyOptional() @IsOptional() carreraId?: number;
  @ApiPropertyOptional() @IsOptional() semestre?: number;
}
