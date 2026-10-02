import * as V from 'class-validator';
import { Transform } from 'class-transformer';
import { IsArray, IsInt } from 'class-validator';
import { toBoolean, ToNumber } from '../../common/validation/transforms';

export class DuplicarTareaDto {
  // Sin grupo, la copia queda en el mismo grupo que la original.
  @V.Min(1)
  @V.Max(2147483647)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @ToNumber()
  @IsInt()
  grupoId?: number;

  @V.IsBoolean()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  conFechas?: boolean;
}

export class ImportarTareasDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  materiaId: number;

  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  grupoDestinoId: number;

  @V.ArrayMinSize(1)
  @V.ArrayMaxSize(200)
  @V.ArrayUnique()
  @V.Min(1, { each: true })
  @V.Max(2147483647, { each: true })
  @IsInt({ each: true })
  @IsArray()
  tareaIds: number[];

  // Desplaza las fechas al periodo del grupo destino; si no, quedan sin fecha.
  @V.IsBoolean()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  ajustarFechas?: boolean;
}
