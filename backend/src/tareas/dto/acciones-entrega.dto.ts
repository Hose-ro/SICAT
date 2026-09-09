import * as V from 'class-validator';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SanitizeText } from '../../common/validation/transforms';

export class MarcarIncorrectaDto {
  @SanitizeText()
  @IsString()
  @Matches(/\S/, { message: 'La observación no puede estar vacía' })
  @MaxLength(5000)
  observacion: string;
}

export class DescargarEntregasDto {
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  entregaIds?: number[];
}

export class EntregaPresencialDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  alumnoId: number;
}
