import * as V from 'class-validator';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @V.IsByteLength(0, 72)
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;

  @V.IsByteLength(0, 72)
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
