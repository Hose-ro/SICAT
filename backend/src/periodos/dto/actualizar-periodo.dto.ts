import { ApiPropertyOptional } from '@nestjs/swagger';
import { ModalidadGrupo } from '@prisma/client';
import { IsEnum, IsOptional, Matches } from 'class-validator';

export class ActualizarPeriodoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de inicio debe tener el formato YYYY-MM-DD',
  })
  fechaInicio: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de fin debe tener el formato YYYY-MM-DD',
  })
  fechaFin: string;

  /** Calendario que se edita; si se omite es el escolarizado. */
  @ApiPropertyOptional({ enum: ModalidadGrupo, default: 'ESCOLARIZADO' })
  @IsOptional()
  @IsEnum(ModalidadGrupo, {
    message: 'La modalidad debe ser ESCOLARIZADO o MIXTO',
  })
  modalidad?: ModalidadGrupo;
}
