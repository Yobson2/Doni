import { Injectable, OnModuleInit } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  UserDataRegistry,
  UserDataSection,
} from '@common/user-data/user-data.registry';
import { RefreshToken } from './entities/refresh-token.entity';

interface ExportedSession {
  startedAt: Date;
  lastRefreshedAt: Date;
  expiresAt: Date;
  /** Signed out, revoked, or expired. */
  ended: boolean;
}

/**
 * The `sessions` section of the user data export: when each session was
 * started and last used. Token hashes and ids are never exported.
 */
@Injectable()
export class SessionsUserData implements UserDataSection, OnModuleInit {
  readonly key = 'sessions';
  readonly entities = [RefreshToken];

  constructor(private readonly registry: UserDataRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async export(
    userId: string,
    manager: EntityManager,
  ): Promise<ExportedSession[]> {
    const rows = await manager.find(RefreshToken, {
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    const now = new Date();
    const sessions = new Map<string, ExportedSession>();
    for (const row of rows) {
      const live = row.revokedAt === null && row.expiresAt > now;
      const session = sessions.get(row.familyId);
      if (!session) {
        sessions.set(row.familyId, {
          startedAt: row.createdAt,
          lastRefreshedAt: row.createdAt,
          expiresAt: row.expiresAt,
          ended: !live,
        });
        continue;
      }
      session.lastRefreshedAt = row.createdAt;
      if (row.expiresAt > session.expiresAt) session.expiresAt = row.expiresAt;
      session.ended = session.ended && !live;
    }
    return [...sessions.values()];
  }
}
