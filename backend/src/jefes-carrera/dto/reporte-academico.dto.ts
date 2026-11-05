import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { SupervisionQueryDto } from './supervision-query.dto';

export class ReporteAcademicoQueryDto extends SupervisionQueryDto {
  @Type(() => Number) @IsInt() @Min(1) grupoId: number;
  @Type(() => Number) @IsInt() @Min(1) materiaId: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) unidadId?: number;
}
export class ExportarAcademicoQueryDto extends ReporteAcademicoQueryDto {
  @IsOptional() @IsIn(['pdf', 'excel']) formato?: 'pdf' | 'excel';
}
