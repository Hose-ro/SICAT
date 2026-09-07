import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Fila del archivo (Excel/CSV) que el docente sube con la lista del grupo.
 * Sólo el nombre es obligatorio: el resto se puede completar después desde el
 * padrón, para no bloquear la carga cuando el archivo no trae todos los datos.
 */
export class AlumnoImportadoDto {
  /**
   * No lleva @IsNotEmpty(): una fila con el nombre en blanco (frecuente en
   * archivos con filas vacías al final) se reporta como error de esa fila en
   * el resultado, en lugar de rechazar el archivo completo.
   */
  @ApiProperty({ example: 'Ana López' })
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({ example: '225Q0103' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{3}[A-Za-z]\d{4}$/, {
    message: 'El número de control debe tener el formato 225Q0103',
  })
  numeroControl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '9611234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'El teléfono debe contener 10 dígitos' })
  telefono?: string;
}

export class ImportarAlumnosDto {
  @ApiProperty({ type: [AlumnoImportadoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => AlumnoImportadoDto)
  alumnos: AlumnoImportadoDto[];

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grupoId?: number;
}
