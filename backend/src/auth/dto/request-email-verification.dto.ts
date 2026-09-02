import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  normalizeEmail,
  transformString,
} from '../../common/identity-normalization';

export class RequestEmailVerificationDto {
  @ApiProperty()
  @Transform(({ value }) => transformString(value as unknown, normalizeEmail))
  @IsEmail()
  @MaxLength(254)
  email: string;
}
