import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService, IssuedSession } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import { Public } from '@common/decorators/public.decorator';
import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@common/config/auth.config';

/**
 * The refresh token lives only in this cookie (ADR 0011): unreadable from
 * JavaScript, sent only over HTTPS, never on cross-site requests, and only to
 * the auth endpoints.
 */
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: REFRESH_COOKIE_PATH,
};

const readRefreshCookie = (req: Request): string | undefined => {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value ? value : undefined;
};

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  @Public()
  @ApiOperation({ operationId: 'signUp', summary: 'Create an account' })
  @ApiCreatedResponse({
    type: SessionResponseDto,
    description: 'Account created and signed in; sets the refresh cookie',
  })
  @ApiConflictResponse({ description: 'Email already has an account' })
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    return this.send(res, await this.authService.signUp(dto));
  }

  @Post('sign-in')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'signIn', summary: 'Sign in' })
  @ApiOkResponse({
    type: SessionResponseDto,
    description: 'Signed in; sets the refresh cookie',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    return this.send(res, await this.authService.signIn(dto));
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({
    operationId: 'refreshSession',
    summary: 'Exchange the refresh cookie for a new access token',
  })
  @ApiOkResponse({
    type: SessionResponseDto,
    description: 'New access token; the refresh cookie is rotated',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    try {
      return this.send(
        res,
        await this.authService.refresh(readRefreshCookie(req)),
      );
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
      throw error;
    }
  }

  @Post('sign-out')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({
    operationId: 'signOut',
    summary: 'End the session and clear the refresh cookie',
  })
  @ApiNoContentResponse({ description: 'Signed out' })
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.signOut(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  }

  private send(res: Response, session: IssuedSession): SessionResponseDto {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...refreshCookieOptions,
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
    return session.body;
  }
}
