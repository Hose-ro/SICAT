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
  @ApiProperty({
    type: [Number],
    example: [12, 13],
    description: 'Bloques actuales de la clase que se va a reconciliar',
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  horarioIds: number[];

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  aulaId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  grupoId?: number | null;

  @ApiProperty({
    type: [HorarioBloqueDto],
    description: 'Estado deseado de la clase: un bloque por día',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HorarioBloqueDto)
  bloques: HorarioBloqueDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semestre?: number | null;
}
