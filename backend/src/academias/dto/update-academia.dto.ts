import { PartialType } from '@nestjs/swagger';
import { CreateAcademiaDto } from './create-academia.dto';

export class UpdateAcademiaDto extends PartialType(CreateAcademiaDto) {}
