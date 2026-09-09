import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';

import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class EliminarGruposDto {
  @V.Min(1, { each: true })
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(100)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ToNumber()
  @IsInt({ each: true })
  grupoIds: number[];
}
