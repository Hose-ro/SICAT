import * as V from 'class-validator';
import { IsArray, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarDocentesDto {
  @V.Min(1, { each: true })
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(500)
  @V.ArrayUnique()
  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  docenteIds: number[];
}
