import { IsOptional, IsString } from 'class-validator';

export class RevisarEntregaDto {
  @IsOptional()
  @IsString()
  observacion?: string;
}
