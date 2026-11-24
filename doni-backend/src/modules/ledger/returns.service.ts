import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorporateActionsService } from '@modules/securities/corporate-actions/corporate-actions.service';
import { MarketIndex } from '@modules/securities/entities/market-index.entity';
import {
  PRICE_SOURCE,
  type PriceSource,
} from '@modules/securities/prices/price-source';
import type { PortfolioReturnsDto, ReturnsPeriod } from './dto/returns.dto';
import { type DatedValue, portfolioReturns } from './engine';
import { Decimal } from './engine/decimal';
import {
  findOwnedPortfolio,
  ledgerOf,
  toEngineEntry,
  today,
  withLedgerErrors,
} from './ledger-records';
import { Portfolio } from './entities/portfolio.entity';

/** The benchmark returns are compared with (ADR 0007). */
const BENCHMARK = { code: 'BRVM-C', name: 'BRVM Composite' };

/**
 * A portfolio's returns over a period: "Mon rendement" (XIRR) and its TWR
 * next to the BRVM Composite, from the ledger and the published end-of-day
 * prices and index values (read only through the PriceSource), with the
 * days on which data is missing. The engine computes; this reads and maps.
 */
@Injectable()
export class ReturnsService {
  constructor(
    @InjectRepository(Portfolio)
    private readonly portfolios: Repository<Portfolio>,
    @InjectRepository(MarketIndex)
    private readonly indices: Repository<MarketIndex>,
    @Inject(PRICE_SOURCE) private readonly priceSource: PriceSource,
    private readonly corporateActions: CorporateActionsService,
  ) {}

  async returns(
    ownerId: string,
    portfolioId: string,
    period: ReturnsPeriod,
  ): Promise<PortfolioReturnsDto> {
    const manager = this.portfolios.manager;
    await findOwnedPortfolio(manager, ownerId, portfolioId);
    const ledger = await ledgerOf(manager, portfolioId);
    const tickers = new Map(
      ledger.map((entry) => [entry.securityId, entry.security?.ticker ?? '']),
    );
    const securityIds = [...tickers.keys()];
    const to = today();

    const prices = new Map<string, DatedValue[]>();
    for (const securityId of securityIds) {
      prices.set(
        securityId,
        toDatedValues(
          await this.priceSource.getHistory({ securityId }, { to }),
        ),
      );
    }
    const index = await this.indices.findOneBy({ code: BENCHMARK.code });
    const benchmark = index
      ? toDatedValues(
          await this.priceSource.getHistory({ indexId: index.id }, { to }),
        )
      : [];

    const corporateActions =
      await this.corporateActions.inEffectFor(securityIds);

    const {
      period: measured,
      xirr,
      series,
      gaps,
    } = withLedgerErrors(ledger, () =>
      portfolioReturns({
        entries: ledger.map(toEngineEntry),
        corporateActions,
        prices,
        benchmark,
        from: periodStart(period, to),
        to,
      }),
    );

    return {
      period,
      from: measured?.from ?? null,
      to: measured?.to ?? null,
      xirr: {
        method: 'xirr',
        annualised: true,
        status: xirr.status,
        percent: xirr.status === 'solved' ? toPercent(xirr.rate) : null,
      },
      comparison: {
        method: 'twr',
        benchmark: {
          code: index?.code ?? BENCHMARK.code,
          name: index?.name ?? BENCHMARK.name,
        },
        points: series.map((point) => ({
          date: point.date,
          portfolio:
            point.portfolio === null ? null : toPercent(point.portfolio),
          benchmark:
            point.benchmark === null ? null : toPercent(point.benchmark),
        })),
      },
      gaps: gaps.map((gap) => ({
        date: gap.date,
        benchmark: gap.benchmark,
        tickers: gap.securityIds
          .map((id) => tickers.get(id) ?? '')
          .sort((a, b) => a.localeCompare(b)),
      })),
    };
  }
}

const toDatedValues = (
  prices: { date: string; close: string }[],
): DatedValue[] => prices.map(({ date, close }) => ({ date, value: close }));

/** A fraction as a percentage with two decimal places: "0.1234" → "12.34". */
export const toPercent = (fraction: string): string =>
  new Decimal(fraction).times('100').toFixed(2);

/**
 * The first day of a period ending on `today` (YYYY-MM-DD): the same day
 * one or three months or a year earlier (the month's last day when that
 * month is shorter), 1 January for the year to date, and for the whole
 * history a day before any ledger entry (the engine then starts at the
 * performance start).
 */
export function periodStart(period: ReturnsPeriod, today: string): string {
  const [year, month, day] = today.split('-').map(Number);
  const monthsBack = (months: number) => {
    const target = new Date(Date.UTC(year, month - 1 - months, 1));
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
  };
  switch (period) {
    case '1M':
      return monthsBack(1);
    case '3M':
      return monthsBack(3);
    case '1Y':
      return monthsBack(12);
    case 'YTD':
      return `${year}-01-01`;
    case 'ALL':
      return '0001-01-01';
  }
}
