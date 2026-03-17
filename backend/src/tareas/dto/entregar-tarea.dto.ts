import { IsOptional, IsString } from 'class-validator';

export class EntregarTareaDto {
  @IsOptional()
  @IsString()
  comentario?: string;
}
