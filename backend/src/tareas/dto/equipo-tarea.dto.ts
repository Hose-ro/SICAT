import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class GuardarEquipoTareaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  equipoId?: number;

  @IsString()
  @MaxLength(80)
  nombre: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  integranteIds: number[];
}
