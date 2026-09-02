import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AUTH_COOKIE_NAME, getAuthCookieClearOptions } from './auth-cookie';
import type { AuthenticatedUser } from './auth.types';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false | null,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    if (err || !user) {
      const response = context.switchToHttp().getResponse<Response>();
      response.clearCookie(
        AUTH_COOKIE_NAME,
        getAuthCookieClearOptions(this.config),
      );
    }

    return super.handleRequest<TUser>(err, user, info, context, status);
  }
}
