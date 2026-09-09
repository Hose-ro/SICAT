import * as V from 'class-validator';
import { toBoolean, SanitizeText } from '../../common/validation/transforms';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class DevolverEntregaDto {
  @V.MaxLength(5000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  observacion?: string;

  @V.IsBoolean()
  @Transform(toBoolean)
  permiteCorreccion: boolean = true;
}
