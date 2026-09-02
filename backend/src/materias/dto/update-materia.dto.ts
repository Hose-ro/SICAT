import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMateriaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ example: 'ACF-0901' })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  clave?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  carreraId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  semestre?: number | null;
}
