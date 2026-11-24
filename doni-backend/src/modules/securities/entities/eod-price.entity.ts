import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';
import { BocBulletin } from '../boc/boc-bulletin.entity';
import { MarketIndex } from './market-index.entity';
import { Security } from './security.entity';

import { PriceStatus } from './price-status';

export { PriceStatus };

/**
 * The end-of-day price of one security, or the value of one index, for one
 * trading day, with its provenance: the BOC it was read from and the date
 * that BOC was published. Consumers read it only through the PriceSource.
 */
@Entity('eod_prices')
@Check(
  'CHK_eod_prices_one_subject',
  `("securityId" IS NULL) <> ("indexId" IS NULL)`,
)
@Index('UQ_eod_prices_security_day', ['securityId', 'tradingDate'], {
  unique: true,
})
@Index('UQ_eod_prices_index_day', ['indexId', 'tradingDate'], {
  unique: true,
})
@Index('IDX_eod_prices_bulletin', ['bulletinId'])
export class EodPrice extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  securityId: string | null;

  @ManyToOne(() => Security, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'securityId' })
  security?: Security | null;

  @Column({ type: 'uuid', nullable: true })
  indexId: string | null;

  @ManyToOne(() => MarketIndex, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'indexId' })
  index?: MarketIndex | null;

  /** The trading day the price applies to (YYYY-MM-DD). */
  @Column({ type: 'date' })
  tradingDate: string;

  @Column({ type: 'numeric' })
  close: string;

  @Column({ type: 'numeric', nullable: true })
  open: string | null;

  @Column({ type: 'numeric', nullable: true })
  high: string | null;

  @Column({ type: 'numeric', nullable: true })
  low: string | null;

  @Column({ type: 'numeric', nullable: true })
  volume: string | null;

  /** The BOC the price was read from (its URL or reference). */
  @Column({ type: 'text' })
  sourceDocument: string;

  /** The date that BOC was published (YYYY-MM-DD). */
  @Column({ type: 'date' })
  publishedOn: string;

  @Column({
    type: 'enum',
    enum: PriceStatus,
    enumName: 'eod_price_status_enum',
    default: PriceStatus.PUBLISHED,
  })
  status: PriceStatus;

  /**
   * The ingested BOC this price was read from; null for a price entered by
   * hand. A price is served only while its bulletin is published.
   */
  @Column({ type: 'uuid', nullable: true })
  bulletinId: string | null;

  @ManyToOne(() => BocBulletin, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bulletinId' })
  bulletin?: BocBulletin | null;
}
