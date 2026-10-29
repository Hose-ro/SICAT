import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SanitizeText } from '../../common/validation/transforms';
import { TIPOS_SEGUIMIENTO, type TipoSeguimiento } from '../supervision.utils';
import { SupervisionQueryDto } from './supervision-query.dto';

/**
 * Nota de seguimiento. Se registra sobre un seguimiento existente (alertaId)
 * o sobre un caso detectado (tipo + referencia); en ese caso el seguimiento se
 * crea con la primera nota.
 */
export class RegistrarSeguimientoDto {
  @IsOptional() @IsInt() @Min(1) alertaId?: number;
  @IsOptional() @IsIn(TIPOS_SEGUIMIENTO) tipo?: TipoSeguimiento;
  @IsOptional() @IsInt() @Min(1) horarioId?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha?: string;
  @IsOptional() @IsInt() @Min(1) alumnoId?: number;
  @IsOptional() @IsInt() @Min(1) materiaId?: number;
  @IsOptional() @IsInt() @Min(1) grupoId?: number;
  @IsOptional() @IsInt() @Min(1) docenteId?: number;

  @SanitizeText() @IsString() @MinLength(3) @MaxLength(2000) texto: string;
  @IsIn(['EN_SEGUIMIENTO', 'CERRADA']) estado: 'EN_SEGUIMIENTO' | 'CERRADA';
  @IsOptional() @IsDateString({ strict: true }) fechaRevision?: string | null;
}

export class InformeQueryDto extends SupervisionQueryDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) desde: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta: string;
}

export class ExportarInformeQueryDto extends InformeQueryDto {
  @IsOptional() @IsIn(['excel', 'pdf']) formato?: 'excel' | 'pdf';
}
