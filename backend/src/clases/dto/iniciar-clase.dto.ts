import { IsInt, Min } from 'class-validator';

export class IniciarClaseDto {
  @IsInt()
  materiaId: number;

  @IsInt()
  @Min(1)
  unidad: number;
}
