import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class BulkRevisarEntregasDto {
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  entregaIds: number[];

  @IsOptional()
  @IsString()
  observacion?: string;
}
