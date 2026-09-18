import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class GuardarSuspensionesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  fechas: string[];

  @IsString()
  @MaxLength(500)
  motivo: string;
}
