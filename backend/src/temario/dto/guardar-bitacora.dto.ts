import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GuardarBitacoraDto {
  @ApiProperty({
    type: [Number],
    description: 'Temas que se vieron en la clase',
  })
  @IsArray()
  @ArrayMaxSize(80)
  @IsInt({ each: true })
  @Min(1, { each: true })
  temaIds!: number[];

  @ApiPropertyOptional({ description: 'Nota breve de la clase' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}
