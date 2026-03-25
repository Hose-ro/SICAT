import {
  IsInt,
  IsString,
  IsNotEmpty,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGrupoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(9)
  semestre: number;

  @ApiProperty({ example: 'A' })
  @IsString()
  @Matches(/^[A-Z]$/, {
    message: 'La sección debe ser una sola letra mayúscula (A-Z)',
  })
  seccion: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  carreraId: number;

  @ApiProperty({ example: '2026-A' })
  @IsString()
  @IsNotEmpty()
  periodo: string;
}
