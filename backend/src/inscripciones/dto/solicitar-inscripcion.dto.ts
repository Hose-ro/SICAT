import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class SolicitarInscripcionDto {
  @IsInt()
  materiaId: number;

  @IsString()
  @IsNotEmpty()
  periodo: string;
}
