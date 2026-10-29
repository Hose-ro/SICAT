import { IsString, Matches } from 'class-validator';

export class TelefonoDocenteDto {
  @IsString()
  @Matches(/^\+52[0-9]{10}$/, {
    message: 'Escribe +52 seguido de los 10 dígitos del número.',
  })
  telefono: string;
}
