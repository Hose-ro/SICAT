import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMateriaDto {
  @ApiProperty() @IsNotEmpty() @IsString() nombre: string;
  @ApiProperty({ example: 'RSB-2403' }) @IsNotEmpty() @IsString() clave: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;
  @ApiProperty({ example: '08:00' }) @IsNotEmpty() @IsString() horaInicio: string;
  @ApiProperty({ example: '10:00' }) @IsNotEmpty() @IsString() horaFin: string;
  @ApiProperty({ example: 'Lunes,Miercoles,Viernes' }) @IsNotEmpty() @IsString() dias: string;
  @ApiProperty({ example: 3 }) @IsInt() @Min(1) numUnidades: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() carreraId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) semestre?: number;
  @ApiPropertyOptional({ description: 'Solo admin puede asignar un docente diferente' })
  @IsOptional() @IsInt() docenteId?: number;
}
