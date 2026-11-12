import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

export class BaseAppException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    public readonly code: ErrorCode,
    public readonly context?: Record<string, unknown>,
  ) {
    super(
      {
        message,
        code,
        errors: [{ message, code, ...(context && { context }) }],
      },
      status,
    );
  }
}
