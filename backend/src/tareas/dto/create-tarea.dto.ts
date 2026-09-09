import * as V from 'class-validator';
import { IsInt, IsNotEmpty, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeText } from '../../common/validation/transforms';

export class CreateTareaDto {
  @V.MaxLength(200)
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty()
  @SanitizeText()
  @IsNotEmpty()
  @IsString()
  titulo: string;
  @V.MaxLength(5000)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  descripcion?: string;
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString({ strict: true, strictSeparator: true })
  fechaLimite?: string;
  @V.Min(1)
  @V.Max(2147483647)
  @ApiProperty()
  @IsInt()
  unidadId: number;
}
