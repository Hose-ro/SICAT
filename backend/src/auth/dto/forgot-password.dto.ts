import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { trimString } from '../../common/identity-normalization';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Correo, usuario o número de control' })
  @Transform(({ value }) => trimString(value as unknown))
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier: string;
}
