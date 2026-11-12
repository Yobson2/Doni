import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../constants/roles.constant';
import { UnauthorizedRoleError } from '../exceptions/auth.exceptions';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * Global guard, run after AuthGuard: a route marked `@Roles(...)` answers 403
 * to an authenticated user without one of those roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new UnauthorizedRoleError(requiredRoles.join(', '));
    }
    return true;
  }
}
