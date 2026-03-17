import { IsInt, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTareaDto {
  @ApiProperty() @IsNotEmpty() @IsString() titulo: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fechaLimite?: string;
  @ApiProperty() @IsInt() unidadId: number;
}
