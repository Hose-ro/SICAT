import * as V from 'class-validator';
import { ToNumber, SanitizeText } from '../../common/validation/transforms';

import { ArrayNotEmpty, IsArray, IsInt, IsString } from 'class-validator';

export class BulkRevisarEntregasDto {
  @V.Min(1, { each: true })
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(500)
  @V.ArrayUnique()
  @IsArray()
  @ArrayNotEmpty()
  @ToNumber()
  @IsInt({ each: true })
  entregaIds: number[];

  @V.MaxLength(5000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  observacion?: string;
}
