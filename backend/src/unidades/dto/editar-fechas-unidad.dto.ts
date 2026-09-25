import * as V from 'class-validator';
import { IsDateString } from 'class-validator';

export class EditarFechasUnidadDto {
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString({ strict: true, strictSeparator: true })
  fechaInicio?: string;

  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString({ strict: true, strictSeparator: true })
  fechaFin?: string;
}
