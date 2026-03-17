import { IsArray, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarMateriasDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  materiaIds: number[];
}
