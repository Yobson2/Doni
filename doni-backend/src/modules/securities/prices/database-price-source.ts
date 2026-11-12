import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { EodPrice, PriceStatus } from '../entities/eod-price.entity';
import type {
  DateRange,
  EndOfDayPrice,
  PriceSource,
  PriceSubject,
} from './price-source';

/** Reads end-of-day prices stored in the database (hand-seeded from BOCs). */
@Injectable()
export class DatabasePriceSource implements PriceSource {
  constructor(
    @InjectRepository(EodPrice)
    private readonly prices: Repository<EodPrice>,
  ) {}

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
      .where({ ...subject, status: PriceStatus.PUBLISHED });
  }
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
