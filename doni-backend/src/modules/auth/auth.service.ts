import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import {
  InvalidCredentialsError,
  InvalidTokenError,
} from '@common/exceptions/auth.exceptions';
import { ACCESS_TOKEN_TTL_SECONDS } from '@common/config/auth.config';
import { SessionsService } from './sessions.service';
import { TokensService } from './tokens.service';

/** A signed-in session: the API response plus the refresh token cookie. */
export interface IssuedSession {
  body: SessionResponseDto;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokensService,
  ) {}

  /** The single sign-up path: creates a member account and signs it in. */
  async signUp(dto: SignUpDto): Promise<IssuedSession> {
    const user = await this.usersService.create(dto);
    this.logger.log(`User signed up: ${user.id}`);
    return this.startSession(user);
  }

  async signIn(dto: SignInDto): Promise<IssuedSession> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordMatches = user
      ? await bcrypt.compare(dto.password, user.password)
      : false;
    if (!user || !passwordMatches || !user.isActive) {
      throw new InvalidCredentialsError();
    }
    this.logger.log(`User signed in: ${user.id}`);
    return this.startSession(user);
  }

  /** Rotates the refresh token and issues a new access token. */
  async refresh(refreshToken: string | undefined): Promise<IssuedSession> {
    if (!refreshToken) {
      throw new InvalidTokenError('Missing refresh token');
    }
    const rotated = await this.sessions.rotate(refreshToken);
    const user = await this.usersService.findByIdOrNull(rotated.userId);
    if (!user || !user.isActive) {
      await this.sessions.end(rotated.token);
      throw new InvalidTokenError('Invalid or expired refresh token');
    }
    return this.respond(user, rotated.token);
  }

  /** Ends the session server-side. Always succeeds. */
  signOut(refreshToken: string | undefined): Promise<void> {
    return this.sessions.end(refreshToken);
  }

  private async startSession(user: User): Promise<IssuedSession> {
    return this.respond(user, await this.sessions.start(user.id));
  }

  private async respond(
    user: User,
    refreshToken: string,
  ): Promise<IssuedSession> {
    const accessToken = await this.tokens.signAccessToken({
      userId: user.id,
      role: user.role,
    });
    return {
      body: {
        accessToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: user.toResponse(),
      },
      refreshToken,
    };
  }
}
