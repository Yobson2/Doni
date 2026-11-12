import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, isUserRole } from '@common/constants/roles.constant';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AuthSecrets,
  REFRESH_TOKEN_TTL_SECONDS,
  loadAuthSecrets,
} from '@common/config/auth.config';

/** Who is making an authenticated request, read from the access token. */
export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

/** What a valid refresh token identifies: one token of one session. */
export interface RefreshClaims {
  userId: string;
  tokenId: string;
  familyId: string;
}

const ALGORITHM = 'HS256';

/**
 * Signs and verifies the two kinds of token (ADR 0011). Each kind has its own
 * secret and a `typ` claim, and verification checks both, so a token of one
 * kind is never accepted as the other.
 */
@Injectable()
export class TokensService {
  private readonly secrets: AuthSecrets;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.secrets = loadAuthSecrets(config);
  }

  signAccessToken(user: AuthenticatedUser): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.userId, role: user.role, typ: 'access' },
      {
        secret: this.secrets.accessSecret,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        algorithm: ALGORITHM,
      },
    );
  }

  /** The user the access token stands for, or null if it is not valid. */
  async verifyAccessToken(token: string): Promise<AuthenticatedUser | null> {
    const payload = await this.verify(token, this.secrets.accessSecret);
    if (
      payload?.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      !isUserRole(payload.role)
    ) {
      return null;
    }
    return { userId: payload.sub, role: payload.role };
  }

  signRefreshToken(claims: RefreshClaims): Promise<string> {
    return this.jwt.signAsync(
      { sub: claims.userId, fam: claims.familyId, typ: 'refresh' },
      {
        secret: this.secrets.refreshSecret,
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
        algorithm: ALGORITHM,
        jwtid: claims.tokenId,
      },
    );
  }

  /** The session token the refresh token stands for, or null. */
  async verifyRefreshToken(token: string): Promise<RefreshClaims | null> {
    const payload = await this.verify(token, this.secrets.refreshSecret);
    if (
      payload?.typ !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      typeof payload.fam !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      tokenId: payload.jti,
      familyId: payload.fam,
    };
  }

  private async verify(
    token: string,
    secret: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret,
        algorithms: [ALGORITHM],
      });
    } catch {
      return null;
    }
  }
}
