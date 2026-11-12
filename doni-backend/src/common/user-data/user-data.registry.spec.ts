import { UserDataRegistry, UserDataSection } from './user-data.registry';

const section = (key: string): UserDataSection => ({
  key,
  entities: [],
  export: () => Promise.resolve([]),
});

describe('UserDataRegistry', () => {
  it('lists the registered sections by key', () => {
    const registry = new UserDataRegistry();
    registry.register(section('watchlist'));
    registry.register(section('account'));
    registry.register(section('portfolios'));

    expect(registry.sections().map((s) => s.key)).toEqual([
      'account',
      'portfolios',
      'watchlist',
    ]);
  });

  it('refuses two sections with the same key', () => {
    const registry = new UserDataRegistry();
    registry.register(section('watchlist'));

    expect(() => registry.register(section('watchlist'))).toThrow(
      /registered twice/,
    );
  });
});
