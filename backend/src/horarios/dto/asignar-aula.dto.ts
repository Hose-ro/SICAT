import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';
import { IsInt, IsPositive } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class AsignarAulaDto {
  @V.Max(2147483647)
  @ApiProperty()
  @ToNumber()
  @IsInt()
  @IsPositive()
  materiaId: number;

  @V.Max(2147483647)
  @ApiProperty()
  @ToNumber()
  @IsInt()
  @IsPositive()
  aulaId: number;
}
