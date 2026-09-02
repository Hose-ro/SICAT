import { IsString, MaxLength, MinLength } from 'class-validator';

export class RechazarImportacionHorarioDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo: string;
}
