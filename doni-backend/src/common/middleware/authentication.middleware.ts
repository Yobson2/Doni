import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';

interface DecodedToken {
  userId?: string;
  role?: string;
  iat?: number;
  [key: string]: unknown;
}

interface RequestWithAuth extends Request {
  user?: unknown;
  refreshId?: string;
  refreshIat?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDecodedToken(value: unknown): value is DecodedToken {
  if (!isRecord(value)) return false;
  return (
    (value.userId === undefined || typeof value.userId === 'string') &&
    (value.iat === undefined || typeof value.iat === 'number')
  );
}

@Injectable()
export class AuthenticationMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const authReq: RequestWithAuth = req;
    const jwt = req
      .header('Authorization')
      ?.trim()
      .replace(/Bearer\s*/g, '');

    try {
      const verified: unknown = this.jwtService.verify(jwt ?? '');
      authReq.user = verified;
    } catch (error) {
      authReq.user = null;
      if (error instanceof TokenExpiredError) {
        const decoded: unknown = this.jwtService.decode(jwt ?? '');
        if (isDecodedToken(decoded)) {
          authReq.refreshId = decoded.userId;
          authReq.refreshIat = decoded.iat;
        }
      }
    }
    next();
  }
}
