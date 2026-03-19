import { PartialType } from '@nestjs/swagger';
import { BaseHorarioDto } from './base-horario.dto';

export class UpdateHorarioDto extends PartialType(BaseHorarioDto) {}
