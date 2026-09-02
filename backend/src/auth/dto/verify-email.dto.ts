import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token: string;
}
