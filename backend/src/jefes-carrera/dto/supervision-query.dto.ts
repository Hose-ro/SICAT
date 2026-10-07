import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class SupervisionQueryDto {
  @Type(() => Number) @IsInt() @Min(1) carreraId: number;
  @IsOptional() @Matches(/^\d{4}-[AB]$/) periodo?: string;
}

export class CalendarioSupervisionQueryDto extends SupervisionQueryDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) desde: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) docenteId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) grupoId?: number;
}
