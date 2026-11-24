import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { BulletinOrigin } from '../boc/boc-bulletin.entity';
import { EodPrice, PriceStatus } from '../entities/eod-price.entity';
import type {
  DateRange,
  EndOfDayPrice,
  PriceSource,
  PriceSubject,
} from './price-source';

/**
 * Reads end-of-day prices stored in the database (hand-seeded from BOCs, or
 * read from ingested ones).
 *
 * The licence gate (ADR 0003, ADR 0018): prices read from backfilled
 * bulletins are history the BRVM's redistribution terms may not cover yet.
 * They are served only when HISTORY_PUBLIC is "true"; otherwise every
 * consumer of the PriceSource (catalogue, company page, indices, valuation,
 * returns, watchlist) behaves as if they were not there. Admins still see
 * them on the bulletin review screens.
 */
@Injectable()
export class DatabasePriceSource implements PriceSource {
  private readonly served: string;

  constructor(
    @InjectRepository(EodPrice)
    private readonly prices: Repository<EodPrice>,
    config: ConfigService,
  ) {
    this.served = isHistoryPublic(config)
      ? BULLETIN_PUBLISHED
      : BULLETIN_PUBLISHED_NOT_BACKFILL;
  }

  async getLatest(subject: PriceSubject): Promise<EndOfDayPrice | null> {
    const row = await this.published(subject)
      .orderBy('p.tradingDate', 'DESC')
      .getOne();
    return row ? toEndOfDayPrice(row) : null;
  }

  async getLatestForSecurities(
    securityIds: string[],
  ): Promise<Map<string, EndOfDayPrice>> {
    const latest = new Map<string, EndOfDayPrice>();
    if (securityIds.length === 0) return latest;

    const rows = await this.prices
      .createQueryBuilder('p')
      .distinctOn(['p.securityId'])
      .where({ securityId: In(securityIds), status: PriceStatus.PUBLISHED })
      .andWhere(this.served)
      .orderBy('p.securityId')
      .addOrderBy('p.tradingDate', 'DESC')
      .getMany();
    for (const row of rows) {
      latest.set(row.securityId as string, toEndOfDayPrice(row));
    }
    return latest;
  }

  async getHistory(
    subject: PriceSubject,
    range: DateRange = {},
  ): Promise<EndOfDayPrice[]> {
    const query = this.published(subject).orderBy('p.tradingDate', 'ASC');
    if (range.from) query.andWhere('p.tradingDate >= :from', range);
    if (range.to) query.andWhere('p.tradingDate <= :to', range);
    return (await query.getMany()).map(toEndOfDayPrice);
  }

  /** Published rows only: pending_review days never leave this class. */
  private published(subject: PriceSubject): SelectQueryBuilder<EodPrice> {
    return this.prices
      .createQueryBuilder('p')
      .where({ ...subject, status: PriceStatus.PUBLISHED })
      .andWhere(this.served);
  }
}

/**
 * A price read from an ingested BOC is served only while that bulletin is
 * published, whatever the row's own status says: a held day can never leak.
 */
const BULLETIN_PUBLISHED = `NOT EXISTS (SELECT 1 FROM "boc_bulletins" "b" WHERE "b"."id" = "p"."bulletinId" AND "b"."status" <> '${PriceStatus.PUBLISHED}')`;

/** The same, and the bulletin is not part of the historical backfill. */
const BULLETIN_PUBLISHED_NOT_BACKFILL = `NOT EXISTS (SELECT 1 FROM "boc_bulletins" "b" WHERE "b"."id" = "p"."bulletinId" AND ("b"."status" <> '${PriceStatus.PUBLISHED}' OR "b"."origin" = '${BulletinOrigin.BACKFILL}'))`;

/** Whether backfilled history is shown to users: HISTORY_PUBLIC=true. Off by default. */
export function isHistoryPublic(config: ConfigService): boolean {
  return config.get<string>('HISTORY_PUBLIC', 'false').trim() === 'true';
}

export function toEndOfDayPrice(row: EodPrice): EndOfDayPrice {
  return {
    date: row.tradingDate,
    close: row.close,
    open: row.open,
    high: row.high,
    low: row.low,
    volume: row.volume,
    sourceDocument: row.sourceDocument,
    publishedOn: row.publishedOn,
  };
}
