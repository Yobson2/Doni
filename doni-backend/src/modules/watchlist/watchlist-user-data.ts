import { Injectable, OnModuleInit } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  UserDataRegistry,
  UserDataSection,
} from '@common/user-data/user-data.registry';
import { WatchlistItem } from './entities/watchlist-item.entity';

/** The `watchlist` section of the user data export. */
@Injectable()
export class WatchlistUserData implements UserDataSection, OnModuleInit {
  readonly key = 'watchlist';
  readonly entities = [WatchlistItem];

  constructor(private readonly registry: UserDataRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async export(
    userId: string,
    manager: EntityManager,
  ): Promise<{ ticker: string; addedAt: Date }[]> {
    const items = await manager.find(WatchlistItem, {
      where: { userId },
      relations: { security: true },
      order: { createdAt: 'ASC' },
    });
    return items.map((item) => ({
      ticker: item.security!.ticker,
      addedAt: item.createdAt,
    }));
  }
}
