import * as V from 'class-validator';
import { ToNumber } from '../../common/validation/transforms';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { HorarioBloqueDto } from './base-horario.dto';

export class ActualizarClaseDto {
  @V.Max(2147483647, { each: true })
  @V.ArrayMaxSize(500)
  @V.ArrayUnique()
  @ApiProperty({
    type: [Number],
    example: [12, 13],
    description: 'Bloques actuales de la clase que se va a reconciliar',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ToNumber()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  horarioIds: number[];

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
  docenteId: number;

  @V.Max(2147483647)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ToNumber()
  @IsInt()
  @IsPositive()
  aulaId?: number | null;

  @V.Max(2147483647)
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ToNumber()
  @IsInt()
  @IsPositive()
  grupoId?: number | null;

  @V.ArrayMaxSize(500)
  @ApiProperty({
    type: [HorarioBloqueDto],
    description: 'Estado deseado de la clase: un bloque por día',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HorarioBloqueDto)
  bloques: HorarioBloqueDto[];

  @V.Min(1)
  @V.Max(12)
  @ApiPropertyOptional()
  @IsOptional()
  @ToNumber()
  @IsInt()
  semestre?: number | null;
}
