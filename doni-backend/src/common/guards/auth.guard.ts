import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { InvalidTokenError } from '../exceptions/auth.exceptions';
import { AuthenticatedUser, TokensService } from '@modules/auth/tokens.service';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Global guard: every route needs a valid access token in the
 * `Authorization: Bearer` header unless it is marked `@Public()`.
 * Missing or invalid credentials answer 401.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.header('authorization') ?? '').split(' ');
    const user =
      scheme === 'Bearer' && token
        ? await this.tokens.verifyAccessToken(token)
        : null;
    if (!user) {
      throw new InvalidTokenError();
    }
    request.user = user;
    return true;
  }
}
