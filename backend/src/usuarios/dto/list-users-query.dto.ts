import * as V from 'class-validator';
import { IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Rol } from '@prisma/client';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ enum: Rol })
  @V.ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(Rol)
  rol?: Rol;
}
