import * as V from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt } from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';

export class EliminarMateriasDto {
  @V.Min(1, { each: true })
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(100)
  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ToNumber()
  @IsInt({ each: true })
  materiaIds: number[];
}
