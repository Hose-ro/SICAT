import { IsInt, IsOptional, IsDateString } from 'class-validator';

export class IniciarClaseDto {
  @IsInt()
  horarioId: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}
