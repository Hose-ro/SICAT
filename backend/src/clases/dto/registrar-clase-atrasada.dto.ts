import { IsBoolean, IsDateString, IsInt, IsOptional } from 'class-validator';

export class RegistrarClaseAtrasadaDto {
  @IsInt()
  horarioId: number;

  @IsDateString()
  fecha: string;

  /**
   * La clase se justificó por una reunión de academia y el docente decide
   * pasar lista de todos modos. No levanta un festivo ni un día sin clases.
   */
  @IsOptional()
  @IsBoolean()
  aunqueJustificada?: boolean;
}
