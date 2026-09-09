import * as V from 'class-validator';
import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AgregarGrupoDocenteDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ApiProperty({
    example: 3,
    description: 'Grupo existente que el docente agrega a su lista',
  })
  @IsInt()
  grupoId: number;
}
