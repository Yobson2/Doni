import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

export interface ErrorEnrichmentOptions {
  code?: ErrorCode;
  operation?: string;
  service?: string;
  context?: Record<string, unknown>;
  userMessage?: string;
  retryable?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorContext {
  private readonly logger = new Logger('ErrorContext');
  private enrichment: ErrorEnrichmentOptions = {};

  constructor(
    private readonly originalError: Error | HttpException,
    private readonly defaultCode?: ErrorCode,
  ) {
    if (defaultCode) {
      this.enrichment.code = defaultCode;
    }
  }

  static wrap(
    error: Error | HttpException,
    defaultCode?: ErrorCode,
  ): ErrorContext {
    return new ErrorContext(error, defaultCode);
  }

  withCode(code: ErrorCode): this {
    this.enrichment.code = code;
    return this;
  }

  withOperation(operation: string): this {
    this.enrichment.operation = operation;
    return this;
  }

  withService(service: string): this {
    this.enrichment.service = service;
    return this;
  }

  withContext(context: Record<string, unknown>): this {
    this.enrichment.context = {
      ...this.enrichment.context,
      ...context,
    };
    return this;
  }

  withUserMessage(message: string): this {
    this.enrichment.userMessage = message;
    return this;
  }

  asRetryable(retryable = true): this {
    this.enrichment.retryable = retryable;
    return this;
  }

  withSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): this {
    this.enrichment.severity = severity;
    return this;
  }

  throw(): never {
    if (!this.enrichment.code) {
      this.logger.error(
        'CRITICAL: Error thrown without error code. This should NEVER happen!',
      );
      throw new InternalServerErrorException({
        error: 'InternalServerError',
        code: 'SYSTEM_INTERNAL_001',
        message: 'An internal error occurred. Error code was not properly set.',
        details:
          this.originalError instanceof Error
            ? this.originalError.message
            : String(this.originalError),
        context: this.enrichment.context,
      });
    }

    if (this.originalError instanceof HttpException) {
      const status = this.originalError.getStatus();
      const response = this.originalError.getResponse();

      throw new HttpException(
        {
          ...(typeof response === 'object' ? response : { message: response }),
          code: this.enrichment.code,
          operation: this.enrichment.operation,
          service: this.enrichment.service,
          context: this.enrichment.context,
          retryable: this.enrichment.retryable,
          severity: this.enrichment.severity,
          userMessage: this.enrichment.userMessage,
        },
        status,
      );
    }

    if (this.originalError instanceof Error) {
      throw new InternalServerErrorException({
        error: 'InternalServerError',
        code: this.enrichment.code,
        message:
          this.enrichment.userMessage ||
          'An error occurred while processing your request',
        details: this.originalError.message,
        operation: this.enrichment.operation,
        service: this.enrichment.service,
        context: this.enrichment.context,
        retryable: this.enrichment.retryable ?? false,
        severity: this.enrichment.severity ?? 'medium',
      });
    }

    throw new InternalServerErrorException({
      error: 'UnknownError',
      code: this.enrichment.code,
      message: this.enrichment.userMessage || 'An unexpected error occurred.',
      operation: this.enrichment.operation,
      service: this.enrichment.service,
      context: this.enrichment.context,
    });
  }

  logAndThrow(logger: Logger): never {
    logger.error(
      `Error in ${this.enrichment.operation || 'unknown operation'}`,
      {
        code: this.enrichment.code,
        service: this.enrichment.service,
        error:
          this.originalError instanceof Error
            ? this.originalError.message
            : this.originalError,
        stack:
          this.originalError instanceof Error
            ? this.originalError.stack
            : undefined,
        context: this.enrichment.context,
      },
    );

    return this.throw();
  }
}

export class ErrorUtils {
  static async wrapServiceCall<T>(
    fn: () => Promise<T>,
    operation: string,
    service: string,
    fallbackCode: ErrorCode,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const typedError =
        error instanceof Error || error instanceof HttpException
          ? error
          : new Error(String(error));

      return ErrorContext.wrap(typedError, fallbackCode)
        .withOperation(operation)
        .withService(service)
        .asRetryable(true)
        .withSeverity('high')
        .throw();
    }
  }

  static isRetryable(error: unknown): boolean {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'object' && 'retryable' in response) {
        return Boolean(response.retryable);
      }
      const status = error.getStatus();
      return (
        status === (HttpStatus.SERVICE_UNAVAILABLE as number) ||
        status === (HttpStatus.GATEWAY_TIMEOUT as number) ||
        status === (HttpStatus.REQUEST_TIMEOUT as number)
      );
    }
    return false;
  }
}
