import * as V from 'class-validator';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trimString } from '../../common/identity-normalization';

export class LoginDto {
  @V.Matches(/\S/, { message: 'El texto no puede estar vacío' })
  @ApiProperty({ description: 'Nombre de usuario o número de control' })
  @Transform(({ value }) => trimString(value as unknown))
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier: string;

  @V.IsByteLength(0, 72)
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
