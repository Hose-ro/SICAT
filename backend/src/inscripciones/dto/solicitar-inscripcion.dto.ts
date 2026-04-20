import { IsInt, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SolicitarInscripcionDto {
  @IsInt()
  materiaId: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  periodo?: string;
}
