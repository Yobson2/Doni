import { Injectable, OnModuleInit } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import {
  UserDataRegistry,
  UserDataSection,
} from '@common/user-data/user-data.registry';
import { LedgerEntryVoid } from './entities/ledger-entry-void.entity';
import { LedgerEntryRecord } from './entities/ledger-entry.entity';
import { Portfolio } from './entities/portfolio.entity';

/**
 * The `portfolios` section of the user data export: each portfolio with its
 * whole ledger, every stored column of every ledger entry (so columns added
 * later are exported too), plus the security's ticker, and the corrections
 * (ADR 0004): which entries were voided, when, and what replaced them.
 */
@Injectable()
export class PortfoliosUserData implements UserDataSection, OnModuleInit {
  readonly key = 'portfolios';
  readonly entities = [Portfolio, LedgerEntryRecord, LedgerEntryVoid];

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
    const voids = await manager.find(LedgerEntryVoid, {
      where: { entryId: In(entries.map((entry) => entry.id)) },
      order: { createdAt: 'ASC' },
    });
    const portfolioOf = new Map(
      entries.map((entry) => [entry.id, entry.portfolioId]),
    );
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
      corrections: voids
        .filter((v) => portfolioOf.get(v.entryId) === portfolio.id)
        .map(({ entryId, replacementId, createdAt }) => ({
          entryId,
          replacementId,
          createdAt,
        })),
    }));
  }
}
