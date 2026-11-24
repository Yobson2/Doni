import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';
import { PriceStatus } from '../entities/price-status';
import type { ParsedTradingDay } from '../prices/price-source';
import type { CheckFailure } from './boc-checks';

/**
 * One trading day's BOC as ingested: the original PDF (kept in Postgres,
 * ADR 0009) with its checksum, what was read from it, and the outcome of the
 * automatic checks. The end-of-day prices stored from it point back to it,
 * and are served only while it is published.
 */
@Entity('boc_bulletins')
export class BocBulletin extends BaseEntity {
  /** The trading day the bulletin covers (YYYY-MM-DD). One per day. */
  @Column({ type: 'date', unique: true })
  tradingDate: string;

  @Column({
    type: 'enum',
    enum: PriceStatus,
    enumName: 'eod_price_status_enum',
  })
  status: PriceStatus;

  /** The PDF exactly as downloaded. Not loaded unless asked for. */
  @Column({ type: 'bytea', select: false })
  document: Buffer;

  /** SHA-256 of the PDF, hex. */
  @Column({ type: 'char', length: 64 })
  checksum: string;

  /** Where the PDF was downloaded from. */
  @Column({ type: 'text' })
  sourceUrl: string;

  @Column({ type: 'timestamptz' })
  fetchedAt: Date;

  /**
   * What was read from the PDF, with any admin corrections applied; null
   * when the PDF could not be read at all.
   */
  @Column({ type: 'jsonb', nullable: true })
  parsed: ParsedTradingDay | null;

  /** Why the day is held; empty once every check passes. */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  failures: CheckFailure[];

  /**
   * The admin who published a held day. A plain id, not a foreign key: the
   * bulletin is market data and outlives the admin's account.
   */
  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;
}
