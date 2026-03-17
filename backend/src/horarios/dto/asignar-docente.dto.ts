import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarDocenteDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  materiaId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  docenteId: number;
}
