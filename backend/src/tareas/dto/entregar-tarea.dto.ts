import * as V from 'class-validator';
import { toBoolean, SanitizeText } from '../../common/validation/transforms';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class EntregarTareaDto {
  @V.MaxLength(5000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  comentario?: string;

  @V.MaxLength(6000)
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  removerArchivoIds?: string;

  @V.IsBoolean()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(toBoolean)
  reemplazarArchivos?: boolean;
}
