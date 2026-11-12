import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SystemErrorCode } from '../constants/error-codes';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProductionEnv = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: Array<{
      message: string;
      field?: string;
      code?: string;
      [key: string]: unknown;
    }> = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errors = [
          {
            message: exceptionResponse,
            code: this.getExceptionCode(exception),
          },
        ];
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;

        if (Array.isArray(responseObj.message)) {
          message = 'Validation failed';
          errors = (responseObj.message as string[]).map((msg) => ({
            message: msg,
            code: 'VALIDATION_ERROR',
          }));
        } else if (responseObj.errors && Array.isArray(responseObj.errors)) {
          message =
            typeof responseObj.message === 'string'
              ? responseObj.message
              : 'An error occurred';
          errors = responseObj.errors as Array<{
            message: string;
            field?: string;
            code?: string;
          }>;
        } else {
          message =
            typeof responseObj.message === 'string'
              ? responseObj.message
              : 'An error occurred';
          errors = [
            {
              message,
              code:
                (responseObj.error as string) ||
                (responseObj.code as string) ||
                this.getExceptionCode(exception),
            },
          ];
        }
      }
    } else if (exception instanceof Error) {
      message = isProductionEnv ? 'Internal server error' : exception.message;
      errors = [
        {
          message,
          code: 'INTERNAL_SERVER_ERROR',
          ...(!isProductionEnv && { errorType: exception.name }),
        },
      ];

      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        isProductionEnv ? undefined : exception.stack,
      );
    } else {
      this.logger.error(`CRITICAL: Unhandled exception type encountered.`, {
        exceptionType: typeof exception,
        url: request.url,
        method: request.method,
      });

      message =
        'An unexpected system error occurred. Our team has been notified.';
      errors = [
        {
          message,
          code: SystemErrorCode.UNEXPECTED_ERROR,
          ...(!isProductionEnv && {
            exceptionType: typeof exception,
            exception: String(exception),
          }),
        },
      ];
    }

    if (!errors || errors.length === 0) {
      errors = [
        {
          message: message || 'A system error occurred. Please try again.',
          code: SystemErrorCode.OPERATION_FAILED,
        },
      ];
    }

    errors = errors.map((err) => {
      if (!err.code || err.code === 'UNKNOWN_ERROR') {
        return {
          ...err,
          code: err.code || SystemErrorCode.OPERATION_FAILED,
        };
      }
      return err;
    });

    this.logger.warn(
      `${request.method} ${request.url} - ${status} - ${message}`,
    );

    const errorResponse = {
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...((!isProductionEnv &&
        exception instanceof Error && {
          stack: exception.stack,
        }) ||
        {}),
    };

    response.status(status).json(errorResponse);
  }

  private getExceptionCode(exception: HttpException): string {
    const status = exception.getStatus();

    switch (status) {
      case HttpStatus.BAD_REQUEST as number:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED as number:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN as number:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND as number:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT as number:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY as number:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS as number:
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.INTERNAL_SERVER_ERROR as number:
        return 'INTERNAL_SERVER_ERROR';
      case HttpStatus.SERVICE_UNAVAILABLE as number:
        return 'SERVICE_UNAVAILABLE';
      default:
        return `HTTP_${status}`;
    }
  }
}
