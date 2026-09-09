import * as V from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Min, Max, IsString } from 'class-validator';

export class GenerarSeccionesDto {
  @V.Max(2147483647)
  @ApiProperty({ example: 6 })
  @IsInt()
  @IsPositive()
  carreraId: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  semestre: number;

  @V.MaxLength(200)
  @V.Matches(/^\d{4}-[AB]$/)
  @ApiProperty({ example: '2026-A', required: false })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  periodo?: string;
}
