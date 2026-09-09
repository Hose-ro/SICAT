import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';
import { ApiProperty } from '@nestjs/swagger';

import { ArrayMinSize, IsArray, IsInt, IsPositive } from 'class-validator';

export class EliminarClaseDto {
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(500)
  @V.ArrayUnique()
  @ApiProperty({ type: [Number], example: [12, 13] })
  @IsArray()
  @ArrayMinSize(1)
  @ToNumber()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  horarioIds: number[];
}
