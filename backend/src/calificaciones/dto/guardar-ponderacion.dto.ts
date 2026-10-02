import * as V from 'class-validator';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SanitizeText, ToNumber } from '../../common/validation/transforms';

export class CategoriaPesoDto {
  // Sin id se crea en el catálogo de la materia (o se reusa la del mismo nombre).
  @V.Min(1)
  @V.Max(2147483647)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  id?: number;

  @V.Matches(/\S/, {
    message: 'El nombre de la categoría no puede estar vacío',
  })
  @V.MaxLength(60)
  @SanitizeText()
  @IsString()
  nombre: string;

  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(100)
  peso: number;
}

export class GuardarPonderacionDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  materiaId: number;

  // Con grupo, la ponderación es sólo de ese grupo; sin grupo, de la materia.
  @V.Min(1)
  @V.Max(2147483647)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  grupoId?: number;

  @ToNumber()
  @IsInt()
  @Min(0)
  @Max(100)
  pesoTareas: number;

  @ToNumber()
  @IsInt()
  @Min(0)
  @Max(100)
  pesoAsistencia: number;

  // Reemplaza las categorías del grupo. Lista vacía: promedio simple de tareas.
  @V.ArrayMaxSize(12)
  @V.ArrayUnique((item: CategoriaPesoDto) =>
    String(item?.nombre ?? '')
      .trim()
      .toLowerCase(),
  )
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoriaPesoDto)
  categorias?: CategoriaPesoDto[];
}
