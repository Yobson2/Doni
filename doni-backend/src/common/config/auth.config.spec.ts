import { ConfigService } from '@nestjs/config';
import { loadAuthSecrets } from './auth.config';

const configWith = (values: Record<string, string>) =>
  new ConfigService(values);

describe('loadAuthSecrets', () => {
  it('returns the two distinct signing secrets', () => {
    expect(
      loadAuthSecrets(
        configWith({
          JWT_ACCESS_SECRET: 'test-only-access',
          JWT_REFRESH_SECRET: 'test-only-refresh',
        }),
      ),
    ).toEqual({
      accessSecret: 'test-only-access',
      refreshSecret: 'test-only-refresh',
    });
  });

  it('refuses to start without an access-token secret', () => {
    expect(() =>
      loadAuthSecrets(configWith({ JWT_REFRESH_SECRET: 'test-only-refresh' })),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('refuses to start without a refresh-token secret', () => {
    expect(() =>
      loadAuthSecrets(configWith({ JWT_ACCESS_SECRET: 'test-only-access' })),
    ).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('refuses to start when both tokens would share one secret', () => {
    expect(() =>
      loadAuthSecrets(
        configWith({
          JWT_ACCESS_SECRET: 'test-only-same',
          JWT_REFRESH_SECRET: 'test-only-same',
        }),
      ),
    ).toThrow(/distinct/);
  });
});
