import { IsString, Matches, MaxLength } from 'class-validator';
import { SanitizeText } from '../../common/validation/transforms';

export class JustificarFaltaDto {
  @SanitizeText()
  @IsString()
  @Matches(/\S/, { message: 'La justificación no puede estar vacía' })
  @MaxLength(5000)
  justificacion: string;
}
