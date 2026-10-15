import * as V from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AsignarAlumnosDto } from './asignar-alumnos.dto';

/**
 * El alumno que el docente agrega desde fuera del grupo entra sólo a sus
 * materias en ese grupo; con `materiaIds` elige a cuáles. Sin él, a todas las
 * que imparte ahí.
 */
export class AgregarAlumnosMiGrupoDto extends AsignarAlumnosDto {
  @ApiPropertyOptional({ example: [4] })
  @V.IsOptional()
  @V.IsArray()
  @V.ArrayMinSize(1)
  @V.ArrayMaxSize(50)
  @V.ArrayUnique()
  @V.IsInt({ each: true })
  @V.Min(1, { each: true })
  @V.Max(2147483647, { each: true })
  materiaIds?: number[];
}
