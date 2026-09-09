import * as V from 'class-validator';
import { ToNumber, SanitizeText } from '../../common/validation/transforms';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BloqueImportacionDto {
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  @Min(1)
  reticulaMateriaId: number;

  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  @Min(1)
  docenteId: number;

  @V.MaxLength(200)
  @IsString()
  @Matches(/^(Lunes|Martes|Miercoles|Jueves|Viernes|Sabado)$/)
  dia: string;

  @V.MaxLength(200)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaInicio: string;

  @V.MaxLength(200)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaFin: string;

  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
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

  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
