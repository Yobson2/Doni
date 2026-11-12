import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { EntityManager, IsNull, LessThan, Repository } from 'typeorm';
import { REFRESH_TOKEN_TTL_SECONDS } from '@common/config/auth.config';
import { JobsService } from '@common/jobs/jobs.service';
import { InvalidTokenError } from '@common/exceptions/auth.exceptions';
import { RefreshToken } from './entities/refresh-token.entity';
import { TokensService } from './tokens.service';

export const SESSIONS_CLEANUP_JOB = 'auth-sessions-cleanup';
export const SESSIONS_CLEANUP_CRON = '17 3 * * *';

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const sameHash = (a: string, b: string): boolean =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Server-side sessions (ADR 0011). A session is a family of refresh tokens:
 * each refresh revokes the presented token and issues its replacement. A
 * token that was already rotated being presented again ends the whole
 * session, since only one party can legitimately hold the latest token.
 */
@Injectable()
export class SessionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly tokens: TokensService,
    private readonly jobs: JobsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.jobs.schedule(SESSIONS_CLEANUP_JOB, SESSIONS_CLEANUP_CRON, () =>
      this.deleteExpired(),
    );
  }

  /** Starts a new session for the user; returns its first refresh token. */
  async start(userId: string): Promise<string> {
    const issued = await this.issue(
      this.refreshTokens.manager,
      userId,
      randomUUID(),
    );
    return issued.token;
  }

  /**
   * Exchanges a refresh token for its replacement. Throws 401 if the token is
   * unknown, expired or revoked; a rotated token also revokes its session.
   */
  async rotate(token: string): Promise<{ userId: string; token: string }> {
    const row = await this.findPresented(token);
    if (!row) {
      throw new InvalidTokenError('Invalid or expired refresh token');
    }

    const rotated = await this.refreshTokens.manager.transaction(
      async (manager) => {
        // Only one request can rotate a token, even when two race.
        const result = await manager
          .createQueryBuilder()
          .update(RefreshToken)
          .set({ revokedAt: () => 'now()' })
          .where('id = :id AND "revokedAt" IS NULL AND "expiresAt" > now()', {
            id: row.id,
          })
          .execute();
        if (result.affected !== 1) {
          return null;
        }
        const next = await this.issue(manager, row.userId, row.familyId);
        await manager.update(RefreshToken, row.id, { replacedBy: next.id });
        return next.token;
      },
    );

    if (!rotated) {
      if (row.revokedAt !== null || row.expiresAt > new Date()) {
        // Already rotated or revoked: treat as a copied token.
        await this.revokeFamily(row.familyId);
        this.logger.warn(
          `Refresh token reused; session revoked for user ${row.userId}`,
        );
      }
      throw new InvalidTokenError('Invalid or expired refresh token');
    }
    return { userId: row.userId, token: rotated };
  }

  /** Ends the session the refresh token belongs to. Silent if unknown. */
  async end(token: string | undefined): Promise<void> {
    const row = token ? await this.findPresented(token) : null;
    if (row) {
      await this.revokeFamily(row.familyId);
    }
  }

  /** Ends the session the refresh token belongs to (by family id). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.refreshTokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: () => 'now()' },
    );
  }

  /** Removes refresh tokens that can no longer be used. */
  async deleteExpired(): Promise<void> {
    const { affected } = await this.refreshTokens.delete({
      expiresAt: LessThan(new Date()),
    });
    if (affected) {
      this.logger.log(`Deleted ${affected} expired refresh tokens`);
    }
  }

  /** The stored row for a validly signed token whose hash matches. */
  private async findPresented(token: string): Promise<RefreshToken | null> {
    const claims = await this.tokens.verifyRefreshToken(token);
    if (!claims) {
      return null;
    }
    const row = await this.refreshTokens.findOne({
      where: { id: claims.tokenId },
    });
    if (!row || !sameHash(row.tokenHash, hashToken(token))) {
      return null;
    }
    return row;
  }

  private async issue(
    manager: EntityManager,
    userId: string,
    familyId: string,
  ): Promise<{ id: string; token: string }> {
    const id = randomUUID();
    const token = await this.tokens.signRefreshToken({
      userId,
      tokenId: id,
      familyId,
    });
    await manager.insert(RefreshToken, {
      id,
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      revokedAt: null,
      replacedBy: null,
    });
    return { id, token };
  }
}
