import { Injectable, OnModuleInit } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import {
  UserDataRegistry,
  UserDataSection,
} from '@common/user-data/user-data.registry';
import { LedgerEntryRecord } from './entities/ledger-entry.entity';
import { Portfolio } from './entities/portfolio.entity';

/**
 * The `portfolios` section of the user data export: each portfolio with its
 * whole ledger, every stored column of every ledger entry (so columns added
 * later are exported too), plus the security's ticker.
 */
@Injectable()
export class PortfoliosUserData implements UserDataSection, OnModuleInit {
  readonly key = 'portfolios';
  readonly entities = [Portfolio, LedgerEntryRecord];

  constructor(private readonly registry: UserDataRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async export(userId: string, manager: EntityManager): Promise<unknown[]> {
    const portfolios = await manager.find(Portfolio, {
      where: { ownerId: userId },
      order: { createdAt: 'ASC' },
    });
    const entries = await manager.find(LedgerEntryRecord, {
      where: { portfolioId: In(portfolios.map((p) => p.id)) },
      relations: { security: true },
      order: { tradeDate: 'ASC', createdAt: 'ASC' },
    });
    return portfolios.map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
      ledger: entries
        .filter((entry) => entry.portfolioId === portfolio.id)
        .map((entry) => {
          const {
            portfolio: _p,
            portfolioId: _id,
            security,
            ...columns
          } = entry;
          return { ...columns, ticker: security?.ticker };
        }),
    }));
  }
}
