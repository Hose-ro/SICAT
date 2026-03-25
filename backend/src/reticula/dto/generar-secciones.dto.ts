import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsPositive,
  Min,
  Max,
  IsOptional,
  IsString,
} from 'class-validator';

export class GenerarSeccionesDto {
  @ApiProperty({ example: 6 })
  @IsInt()
  @IsPositive()
  carreraId: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  semestre: number;

  @ApiProperty({ example: '2026-A', required: false })
  @IsOptional()
  @IsString()
  periodo?: string;
}
