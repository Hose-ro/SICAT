import * as V from 'class-validator';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeText } from '../../common/validation/transforms';

export class CreateAcademiaDto {
  @V.MaxLength(200)
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty()
  @SanitizeText()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  nombre: string;

  @V.MaxLength(5000)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  descripcion?: string;
}
