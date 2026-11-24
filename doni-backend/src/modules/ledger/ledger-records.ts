import type { EntityManager } from 'typeorm';
import {
  ConflictingOpeningPositionsException,
  InsufficientQuantityException,
  InvalidLedgerEntryException,
  PortfolioNotFoundError,
} from '@common/exceptions/ledger.exceptions';
import type { LedgerEntryDto } from './dto/portfolio.dto';
import {
  ConflictingOpeningPositionsError,
  InsufficientQuantityError,
  InvalidLedgerEntryError,
  type LedgerEntry,
} from './engine';
import {
  LedgerEntryKind,
  LedgerEntryRecord,
} from './entities/ledger-entry.entity';
import { Portfolio } from './entities/portfolio.entity';

/*
 * How the ledger module reads stored ledgers and hands them to the engine:
 * shared by the portfolios and the dividends services.
 */

/** The user's portfolio with that id; anyone else's is "not found". */
export async function findOwnedPortfolio(
  manager: EntityManager,
  ownerId: string,
  id: string,
  { lock = false } = {},
): Promise<Portfolio> {
  const portfolio = await manager.findOne(Portfolio, {
    where: { id, ownerId },
    ...(lock && { lock: { mode: 'pessimistic_write' as const } }),
  });
  if (!portfolio) throw new PortfolioNotFoundError(id);
  return portfolio;
}

/**
 * The portfolio's ledger as it stands: every entry not voided by a
 * correction, oldest trade first, each with its security.
 */
export function ledgerOf(
  manager: EntityManager,
  portfolioId: string,
): Promise<LedgerEntryRecord[]> {
  return manager
    .createQueryBuilder(LedgerEntryRecord, 'entry')
    .innerJoinAndSelect('entry.security', 'security')
    .where('entry.portfolioId = :portfolioId', { portfolioId })
    .andWhere(
      `NOT EXISTS (SELECT 1 FROM "ledger_entry_voids" "void" WHERE "void"."entryId" = "entry"."id")`,
    )
    .orderBy('entry.tradeDate', 'ASC')
    .addOrderBy('entry.createdAt', 'ASC')
    .addOrderBy('entry.id', 'ASC')
    .getMany();
}

/** A stored ledger entry as the engine sees it. */
export function toEngineEntry(record: LedgerEntryRecord): LedgerEntry {
  const common = {
    id: record.id,
    securityId: record.securityId,
    date: record.tradeDate,
  };
  switch (record.kind) {
    case LedgerEntryKind.OPENING_POSITION:
      return {
        ...common,
        kind: 'opening_position',
        quantity: record.quantity,
        pmp: record.price,
      };
    case LedgerEntryKind.DIVIDEND:
      return { ...common, kind: 'dividend', amount: record.amount ?? '' };
    default:
      return {
        ...common,
        kind: record.kind,
        quantity: record.quantity,
        price: record.price,
        fees: record.fees,
      };
  }
}

/**
 * Runs `work` (an engine call over `ledger`), turning a broken ledger rule
 * into the API error that names the entry's security.
 */
export function withLedgerErrors<T>(
  ledger: readonly LedgerEntryRecord[],
  work: () => T,
): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof InsufficientQuantityError) {
      const entry = ledger.find((e) => e.id === error.entryId);
      throw new InsufficientQuantityException({
        ticker: entry?.security?.ticker ?? '',
        date: error.date,
        held: error.held,
        sold: error.sold,
      });
    }
    if (error instanceof ConflictingOpeningPositionsError) {
      const entry = ledger.find((e) => e.id === error.entryId);
      throw new ConflictingOpeningPositionsException({
        ticker: entry?.security?.ticker ?? '',
        date: error.date,
      });
    }
    if (error instanceof InvalidLedgerEntryError) {
      throw new InvalidLedgerEntryException(error.field, error.value);
    }
    throw error;
  }
}

export function toLedgerEntryDto(
  record: LedgerEntryRecord,
  replacesId: string | null,
): LedgerEntryDto {
  return {
    id: record.id,
    kind: record.kind,
    ticker: record.security?.ticker ?? '',
    securityName: record.security?.name ?? '',
    date: record.tradeDate,
    quantity: record.quantity,
    price: record.price,
    fees: record.fees,
    amount: record.amount ?? null,
    referenceDividendId: record.referenceDividendId ?? null,
    sgi: record.sgi,
    recordedAt: record.createdAt.toISOString(),
    replacesId,
  };
}

/** Today's date (UTC) as YYYY-MM-DD. */
export const today = () => new Date().toISOString().slice(0, 10);
