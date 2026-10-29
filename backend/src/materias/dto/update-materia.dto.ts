import * as V from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SanitizeText, ToNumber } from '../../common/validation/transforms';

export class UpdateMateriaDto {
  @V.MaxLength(200)
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsNotEmpty()
  @IsString()
  nombre?: string;

  @V.MaxLength(200)
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiPropertyOptional({ example: 'ACF-0901' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsNotEmpty()
  @IsString()
  clave?: string;

  @V.MaxLength(5000)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  descripcion?: string;

  @V.Min(1)
  @V.Max(2147483647)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  carreraId?: number | null;

  @V.Max(12)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  semestre?: number | null;

  /**
   * Unidades en la misma operación que los datos generales: si la reducción
   * pide confirmación o algo falla, no se guarda nada.
   */
  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 12 })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(12)
  numUnidades?: number;

  /** Confirma una reducción de unidades que borra lo registrado en las sobrantes. */
  @ApiPropertyOptional({ default: false })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  forzar?: boolean;
}
