import { IsArray, IsInt, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class AlumnoAsistencia {
  @ApiProperty() @IsInt() alumnoId: number;
  @ApiProperty() @IsBoolean() presente: boolean;
}

export class RegistrarAsistenciaDto {
  @ApiProperty() @IsInt() claseId: number;
  @ApiProperty({ type: [AlumnoAsistencia] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlumnoAsistencia)
  asistencias: AlumnoAsistencia[];
}
