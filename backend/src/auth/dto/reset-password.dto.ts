import * as V from 'class-validator';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token: string;

  @V.IsByteLength(0, 72)
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
