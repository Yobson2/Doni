import { HttpStatus } from '@nestjs/common';
import { AuthErrorCode } from '../constants/error-codes';
import { BaseAppException } from './base.exception';

export class InvalidCredentialsError extends BaseAppException {
  constructor() {
    super(
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
      AuthErrorCode.INVALID_CREDENTIALS,
    );
  }
}

export class TokenExpiredError extends BaseAppException {
  constructor() {
    super(
      'Authentication token has expired',
      HttpStatus.UNAUTHORIZED,
      AuthErrorCode.TOKEN_EXPIRED,
    );
  }
}

export class InvalidTokenError extends BaseAppException {
  constructor(detail?: string) {
    super(
      detail || 'Invalid authentication token',
      HttpStatus.UNAUTHORIZED,
      AuthErrorCode.TOKEN_INVALID,
    );
  }
}

export class UnauthorizedRoleError extends BaseAppException {
  constructor(requiredRole: string) {
    super(
      `Access denied. Required role: ${requiredRole}`,
      HttpStatus.FORBIDDEN,
      AuthErrorCode.UNAUTHORIZED_ROLE,
      { requiredRole },
    );
  }
}
