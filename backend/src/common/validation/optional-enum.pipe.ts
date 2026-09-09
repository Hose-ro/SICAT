import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';

export class OptionalEnumPipe implements PipeTransform {
  constructor(private readonly values: readonly string[]) {}

  transform(value: unknown) {
    if (value === undefined) return value;
    if (typeof value !== 'string' || !this.values.includes(value)) {
      throw new BadRequestException('El estado indicado no es válido');
    }
    return value;
  }
}
