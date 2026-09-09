import * as V from 'class-validator';
import { IsArray, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarAlumnosDto {
  @V.Min(1, { each: true })
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(500)
  @V.ArrayUnique()
  @ApiProperty({ example: [1, 2, 3] })
  @IsArray()
  @IsInt({ each: true })
  alumnoIds: number[];
}
