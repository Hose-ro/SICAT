import { PartialType } from '@nestjs/swagger';
import { CrearTareaDto } from './crear-tarea.dto';

export class UpdateTareaDto extends PartialType(CrearTareaDto, {
  skipNullProperties: false,
}) {}
