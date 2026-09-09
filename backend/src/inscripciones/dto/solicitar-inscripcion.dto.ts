import * as V from 'class-validator';
import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class SolicitarInscripcionDto {
  @V.Min(1)
  @V.Max(2147483647)
  @IsInt()
  materiaId: number;

  @V.MaxLength(200)
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @V.Matches(/^\d{4}-[AB]$/)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  periodo?: string;
}
