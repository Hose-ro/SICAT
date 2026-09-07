import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AgregarGrupoDocenteDto {
  @ApiProperty({ example: 3, description: 'Grupo existente que el docente agrega a su lista' })
  @IsInt()
  grupoId: number;
}
