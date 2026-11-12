import type { EntityManager } from 'typeorm';
import { UserDataRegistry } from '@common/user-data/user-data.registry';
import type { RefreshToken } from './entities/refresh-token.entity';
import { SessionsUserData } from './sessions-user-data';

const DAY = 24 * 60 * 60 * 1000;
const at = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY);

const token = (
  familyId: string,
  createdAt: Date,
  expiresAt: Date,
  revokedAt: Date | null,
): RefreshToken =>
  ({
    id: `${familyId}-${createdAt.getTime()}`,
    userId: 'user-1',
    familyId,
    tokenHash: 'secret-hash',
    createdAt,
    expiresAt,
    revokedAt,
    replacedBy: null,
  }) as RefreshToken;

describe('SessionsUserData', () => {
  it('exports one entry per session, without token hashes', async () => {
    const rows = [
      // Session A: started 3 days ago, rotated yesterday, still live.
      token('a', at(-3), at(27), at(-1)),
      token('a', at(-1), at(29), null),
      // Session B: signed out.
      token('b', at(-2), at(28), at(-2)),
    ];
    const manager = {
      find: jest.fn().mockResolvedValue(rows),
    } as unknown as EntityManager;
    const section = new SessionsUserData(new UserDataRegistry());

    const exported = await section.export('user-1', manager);

    expect(exported).toEqual([
      {
        startedAt: rows[0].createdAt,
        lastRefreshedAt: rows[1].createdAt,
        expiresAt: rows[1].expiresAt,
        ended: false,
      },
      {
        startedAt: rows[2].createdAt,
        lastRefreshedAt: rows[2].createdAt,
        expiresAt: rows[2].expiresAt,
        ended: true,
      },
    ]);
    expect(JSON.stringify(exported)).not.toContain('secret-hash');
  });
});
