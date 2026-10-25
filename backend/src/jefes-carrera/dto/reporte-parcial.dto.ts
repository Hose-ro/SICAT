import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';

export class ContextoReporteParcialQueryDto {
  @IsOptional() @Matches(/^\d{4}-[AB]$/) periodo?: string;
}

export class ReporteParcialQueryDto extends ContextoReporteParcialQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) carreraId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) docenteId?: number;
}

export class ExportarReporteParcialQueryDto extends ReporteParcialQueryDto {
  @IsOptional() @IsIn(['excel', 'pdf']) formato?: 'excel' | 'pdf';
}
