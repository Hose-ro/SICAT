import { Matches } from 'class-validator';

export class ActualizarPeriodoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de inicio debe tener el formato YYYY-MM-DD',
  })
  fechaInicio: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de fin debe tener el formato YYYY-MM-DD',
  })
  fechaFin: string;
}
