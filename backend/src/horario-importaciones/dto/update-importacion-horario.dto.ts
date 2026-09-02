import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BloqueImportacionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reticulaMateriaId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  docenteId: number;

  @IsString()
  @Matches(/^(Lunes|Martes|Miercoles|Jueves|Viernes|Sabado)$/)
  dia: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaInicio: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaFin: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  aulaDetectada?: string;
}

export class UpdateImportacionHorarioDto {
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => BloqueImportacionDto)
  bloques: BloqueImportacionDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
