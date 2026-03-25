import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMateriaDto {
  @ApiProperty() @IsNotEmpty() @IsString() nombre: string;
  @ApiProperty({ example: 'RSB-2403' }) @IsNotEmpty() @IsString() clave: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;
  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaInicio?: string;
  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaFin?: string;
  @ApiPropertyOptional({ example: 'Lunes,Miercoles,Viernes' })
  @IsOptional()
  @IsString()
  dias?: string;
  @ApiProperty({ example: 3 }) @IsInt() @Min(1) numUnidades: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() carreraId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) semestre?: number;
  @ApiPropertyOptional({
    description: 'Solo admin puede asignar un docente diferente',
  })
  @IsOptional()
  @IsInt()
  docenteId?: number;
}
