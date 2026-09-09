import * as V from 'class-validator';
import { IsArray, IsInt, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class AlumnoAsistencia {
  @V.Min(1)
  @V.Max(2147483647)
  @ApiProperty()
  @IsInt()
  alumnoId: number;
  @ApiProperty() @IsBoolean() presente: boolean;
}

export class RegistrarAsistenciaDto {
  @V.Min(1)
  @V.Max(2147483647)
  @ApiProperty()
  @IsInt()
  claseId: number;
  @V.ArrayMaxSize(500)
  @ApiProperty({ type: [AlumnoAsistencia] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlumnoAsistencia)
  asistencias: AlumnoAsistencia[];
}
