import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Nombre de usuario o número de control' })
  @IsString()
  @IsNotEmpty()
  identifier: string;
  @ApiProperty() @IsString() @IsNotEmpty() password: string;
}
