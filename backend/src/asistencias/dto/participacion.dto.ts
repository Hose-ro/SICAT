import * as V from 'class-validator';
import { IsInt, IsString } from 'class-validator';
import { SanitizeText, ToNumber } from '../../common/validation/transforms';

export class RegistrarParticipacionDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ToNumber()
  @IsInt()
  alumnoId: number;

  // +1 por cada participación; -1 para corregir un toque de más.
  @V.Min(-5)
  @V.Max(5)
  @ToNumber()
  @IsInt()
  delta: number;

  @V.MaxLength(300)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  nota?: string;
}
