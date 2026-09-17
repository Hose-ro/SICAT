import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import type { Request, Response, NextFunction } from 'express';

// API filters are scalar. Reject duplicate keys and object/array query syntax,
// including when Express's simple parser preserves brackets in the key name.
export function validateQueryShape(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (
    Object.entries(request.query).some(
      ([key, value]) =>
        !/^[A-Za-z][A-Za-z0-9]*$/.test(key) || typeof value !== 'string',
    )
  ) {
    response
      .status(400)
      .json({
        statusCode: 400,
        message: 'Los filtros deben ser valores simples sin duplicados',
        error: 'Bad Request',
      });
    return;
  }
  next();
}

// These rules apply before controllers can use Number()/parseInt() or truthiness.
export class InputValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      validationError: { target: false, value: false },
    });
  }

  override async transform(value: unknown, metadata: ArgumentMetadata) {
    if (
      (metadata.type === 'query' || metadata.type === 'param') &&
      metadata.data
    ) {
      const key = metadata.data;
      if (value !== undefined) {
        if (typeof value !== 'string') this.invalid(key);
        const text = value as string;
        if (
          key === 'id' ||
          key.endsWith('Id') ||
          ['semestre', 'skip', 'take'].includes(key)
        ) {
          const min = key === 'skip' ? 0 : 1;
          const max =
            key === 'semestre' ? 12 : key === 'take' ? 100 : 2147483647;
          const number = Number(text);
          if (
            !/^\d+$/.test(text) ||
            !Number.isSafeInteger(number) ||
            number < min ||
            number > max
          )
            this.invalid(key);
        } else if (['activo', 'soloNoLeidas', 'tardia'].includes(key)) {
          if (!['true', 'false'].includes(text)) this.invalid(key);
        } else if (['pesoTareas', 'pesoAsistencia'].includes(key)) {
          if (!/^\d+(\.\d+)?$/.test(text) || Number(text) > 100)
            this.invalid(key);
        } else if (['fecha', 'semana'].includes(key)) {
          if (!isISO8601(text, { strict: true, strictSeparator: true }))
            this.invalid(key);
        } else if (key === 'periodo') {
          if (!/^\d{4}-[AB]$/.test(text)) this.invalid(key);
        } else if (key === 'seccion') {
          if (!/^[A-Z]$/.test(text)) this.invalid(key);
        } else if (key === 'formato') {
          if (!['excel', 'pdf', 'csv'].includes(text)) this.invalid(key);
        } else if (text.length > 200 || (key === 'clave' && !text.trim())) {
          this.invalid(key);
        }
      }
    }
    return super.transform(value, metadata);
  }

  private invalid(key: string): never {
    throw new BadRequestException(`El parámetro ${key} no es válido`);
  }
}
