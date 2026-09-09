import * as V from 'class-validator';
import { IsInt, IsDateString } from 'class-validator';

export class IniciarClaseDto {
  @V.Min(1)
  @V.Max(2147483647)
  @IsInt()
  horarioId: number;

  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString({ strict: true, strictSeparator: true })
  fecha?: string;
}
