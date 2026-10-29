import * as V from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoCriterio } from '@prisma/client';
import {
  SanitizeText,
  ToNumber,
  toBoolean,
} from '../../common/validation/transforms';
import { MAX_CRITERIOS, META_MAXIMA } from '../criterios';

export class CriterioDto {
  // Sin id se busca por nombre en el catálogo de la materia o se crea.
  @V.Min(1)
  @V.Max(2147483647)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  id?: number;

  @V.Matches(/\S/, { message: 'El nombre del criterio no puede estar vacío' })
  @V.MaxLength(60)
  @SanitizeText()
  @IsString()
  nombre: string;

  @IsEnum(TipoCriterio)
  tipo: TipoCriterio;

  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(100)
  peso: number;

  // Sólo participación: cuántas participaciones valen 100 en la unidad.
  @V.ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(META_MAXIMA)
  meta?: number | null;
}

export class GuardarCriteriosDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  materiaId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  grupoId: number;

  // Con unidad, los porcentajes son sólo de esa unidad; sin ella, de todas.
  @V.Min(1)
  @V.Max(2147483647)
  @V.ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @ToNumber()
  @IsInt()
  unidadId?: number | null;

  @V.ArrayMinSize(1)
  @V.ArrayMaxSize(MAX_CRITERIOS)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterioDto)
  criterios: CriterioDto[];

  // Las unidades ya finalizadas conservan los porcentajes con que se
  // calificaron (por defecto, sí).
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  @IsBoolean()
  conservarUnidadesCerradas?: boolean;
}
