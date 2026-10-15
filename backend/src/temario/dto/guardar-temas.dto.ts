import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemaDto {
  @ApiPropertyOptional({
    description: 'Id de un tema existente; sin id se crea',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiProperty()
  @IsString()
  @Matches(/\S/, { message: 'El tema no puede estar vacío' })
  @MaxLength(300)
  nombre!: string;

  @ApiPropertyOptional({ description: 'Semana del curso en que se planea' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  semana?: number | null;
}

export class GuardarTemasDto {
  @ApiProperty({ type: [TemaDto] })
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => TemaDto)
  temas!: TemaDto[];
}
