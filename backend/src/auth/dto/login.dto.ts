import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Email, username o número de control' })
  @IsString() @IsNotEmpty() identifier: string;
  @ApiProperty() @IsString() @IsNotEmpty() password: string;
}
