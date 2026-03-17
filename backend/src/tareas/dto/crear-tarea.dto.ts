import { IsInt, IsString, IsNotEmpty, IsEnum, IsDateString, IsOptional, Min } from 'class-validator';
import { TipoEntrega } from '@prisma/client';

export class CrearTareaDto {
  @IsInt()
  materiaId: number;

  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  instrucciones: string;

  @IsInt()
  @Min(1)
  unidad: number;

  @IsEnum(TipoEntrega)
  tipoEntrega: TipoEntrega;

  @IsDateString()
  fechaLimite: string;
}
