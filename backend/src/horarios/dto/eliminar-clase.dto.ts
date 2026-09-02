import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsPositive } from 'class-validator';

export class EliminarClaseDto {
  @ApiProperty({ type: [Number], example: [12, 13] })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  horarioIds: number[];
}
