import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CapturaSegundaOportunidadDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  alumnoId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  unidadId!: number;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  calificacion?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noPresento?: boolean;
}

export class GuardarSegundaOportunidadDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  materiaId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  grupoId!: number;

  @ApiProperty({ type: [CapturaSegundaOportunidadDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CapturaSegundaOportunidadDto)
  capturas!: CapturaSegundaOportunidadDto[];
}
