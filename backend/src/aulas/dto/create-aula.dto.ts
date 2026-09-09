import * as V from 'class-validator';
import { IsNotEmpty, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeText } from '../../common/validation/transforms';

export class CreateAulaDto {
  @V.MaxLength(200)
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty({ example: 'Aula 101' })
  @SanitizeText()
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @V.MaxLength(200)
  @ApiPropertyOptional({ example: 'Edificio A' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  edificio?: string;

  @ApiPropertyOptional({ example: 40 })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  capacidad?: number;
}
