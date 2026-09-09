import * as V from 'class-validator';
import { IsInt, IsNotEmpty, IsString, Matches, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeText } from '../../common/validation/transforms';

export class CreateMateriaDto {
  @V.MaxLength(200)
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty()
  @SanitizeText()
  @IsNotEmpty()
  @IsString()
  nombre: string;
  @V.MaxLength(200)
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty({ example: 'RSB-2403' })
  @SanitizeText()
  @IsNotEmpty()
  @IsString()
  clave: string;
  @V.MaxLength(5000)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @SanitizeText()
  @IsString()
  descripcion?: string;
  @ApiPropertyOptional({ example: '08:00' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaInicio?: string;
  @ApiPropertyOptional({ example: '10:00' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaFin?: string;
  @V.MaxLength(200)
  @ApiPropertyOptional({ example: 'Lunes,Miercoles,Viernes' })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  dias?: string;
  @V.Max(12)
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  numUnidades: number;
  @V.Min(1)
  @V.Max(2147483647)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  carreraId?: number;
  @V.Max(12)
  @ApiPropertyOptional()
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  semestre?: number;
  @V.Min(1)
  @V.Max(2147483647)
  @ApiPropertyOptional({
    description: 'Solo admin puede asignar un docente diferente',
  })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  docenteId?: number;
}
