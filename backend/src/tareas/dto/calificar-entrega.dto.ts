import { IsNumber, Min, Max, IsOptional, IsString } from 'class-validator';

export class CalificarEntregaDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  calificacion: number;

  @IsOptional()
  @IsString()
  observacion?: string;
}
