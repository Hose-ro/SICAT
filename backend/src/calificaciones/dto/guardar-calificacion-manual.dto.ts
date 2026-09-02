import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class GuardarCalificacionManualDto {
  @Type(() => Number)
  @IsInt()
  alumnoId: number;

  @Type(() => Number)
  @IsInt()
  materiaId: number;

  @Type(() => Number)
  @IsInt()
  unidadId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  grupoId?: number;

  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  calificacionManual?: number | null;

  @IsOptional()
  @IsString()
  observacion?: string;
}
