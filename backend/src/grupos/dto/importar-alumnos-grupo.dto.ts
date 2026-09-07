import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { AlumnoImportadoDto } from '../../inscripciones/dto/importar-alumnos.dto';

/**
 * Misma fila que la importación por materia; aquí el destino es el grupo, así
 * que no viaja `grupoId`: es el de la ruta.
 */
export class ImportarAlumnosGrupoDto {
  @ApiProperty({ type: [AlumnoImportadoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => AlumnoImportadoDto)
  alumnos: AlumnoImportadoDto[];
}
