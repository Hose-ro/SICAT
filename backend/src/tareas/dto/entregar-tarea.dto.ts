import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

const toBoolean = ({ value }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string')
    return ['true', '1', 'on', 'yes'].includes(value.toLowerCase());
  return false;
};

export class EntregarTareaDto {
  @IsOptional()
  @IsString()
  comentario?: string;

  @IsOptional()
  @IsString()
  removerArchivoIds?: string;

  @IsOptional()
  @Transform(toBoolean)
  reemplazarArchivos?: boolean;
}
