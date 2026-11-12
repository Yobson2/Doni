import { HttpStatus } from '@nestjs/common';
import { UserErrorCode } from '../constants/error-codes';
import { BaseAppException } from './base.exception';

export class UserNotFoundError extends BaseAppException {
  constructor(identifier: string, identifierType: string = 'id') {
    super(
      `User not found: ${identifierType} = ${identifier}`,
      HttpStatus.NOT_FOUND,
      UserErrorCode.USER_NOT_FOUND,
      { identifier, identifierType },
    );
  }
}

export class UserAlreadyExistsError extends BaseAppException {
  constructor(email: string) {
    super(
      `User with email ${email} already exists`,
      HttpStatus.CONFLICT,
      UserErrorCode.USER_ALREADY_EXISTS,
      { email },
    );
  }
}

export class UserUpdateFailedError extends BaseAppException {
  constructor(userId: string, reason?: string) {
    super(
      reason || `Failed to update user ${userId}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      UserErrorCode.PROFILE_UPDATE_FAILED,
      { userId },
    );
  }
}
