import * as V from 'class-validator';
import { IsInt, Max, Min } from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';

export class GuardarPonderacionDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  materiaId: number;

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
}
