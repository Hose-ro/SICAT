import { IsString, MaxLength, MinLength } from 'class-validator';
import { SanitizeText } from '../../common/validation/transforms';

export class RechazarImportacionHorarioDto {
  @SanitizeText()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo: string;
}
