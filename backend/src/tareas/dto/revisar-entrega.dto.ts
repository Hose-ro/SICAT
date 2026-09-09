import * as V from 'class-validator';
import { IsString } from 'class-validator';
import { SanitizeText } from '../../common/validation/transforms';

export class RevisarEntregaDto {
  @V.MaxLength(5000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  observacion?: string;
}
