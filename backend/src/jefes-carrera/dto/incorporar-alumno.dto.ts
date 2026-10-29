import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class IncorporarAlumnoDto {
  @IsInt() @Min(1) alumnoId: number;
  @IsInt() @Min(1) materiaId: number;
  @IsInt() @Min(1) grupoId: number;
  @IsString() @MinLength(5) @MaxLength(500) motivo: string;
  @IsOptional() @IsBoolean() resolverSolicitud?: boolean;
}
