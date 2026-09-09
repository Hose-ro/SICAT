import { IsInt, IsDateString } from 'class-validator';

export class RegistrarClaseAtrasadaDto {
  @IsInt()
  horarioId: number;

  @IsDateString()
  fecha: string;
}
