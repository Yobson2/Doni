import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Security } from '@modules/securities/entities/security.entity';
import { Portfolio } from './portfolio.entity';

export enum LedgerEntryKind {
  BUY = 'buy',
  SELL = 'sell',
  /** Quantity and PMP held as of a date, instead of past trades (ADR 0001). */
  OPENING_POSITION = 'opening_position',
}

/**
 * One dated, immutable record in a portfolio's ledger (ADR 0004). Rows are
 * only ever inserted: the table has no `updatedAt`, and the database rejects
 * any UPDATE. Amounts are XOF, stored as `numeric` (ADR 0005, 0008).
 */
@Entity('ledger_entries')
@Check(
  'CHK_ledger_entries_amounts',
  `"quantity" > 0 AND "price" >= 0 AND "fees" >= 0`,
)
@Index('IDX_ledger_entries_portfolio_date', ['portfolioId', 'tradeDate'])
export class LedgerEntryRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  portfolioId: string;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolioId' })
  portfolio?: Portfolio;

  @Column({
    type: 'enum',
    enum: LedgerEntryKind,
    enumName: 'ledger_entry_kind_enum',
  })
  kind: LedgerEntryKind;

  @Column({ type: 'uuid' })
  securityId: string;

  @ManyToOne(() => Security, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'securityId' })
  security?: Security;

  /** The trade date, or the date an opening position is stated for. */
  @Column({ type: 'date' })
  tradeDate: string;

  /** Number of shares. */
  @Column({ type: 'numeric' })
  quantity: string;

  /**
   * Price per share, excluding fees. For an opening position, its PMP
   * (fees included, ADR 0006), and its fees are 0.
   */
  @Column({ type: 'numeric' })
  price: string;

  /** Total fees charged for the trade. */
  @Column({ type: 'numeric', default: 0 })
  fees: string;

  /** The SGI the trade went through. */
  @Column({ type: 'varchar', length: 100 })
  sgi: string;

  /** When the entry was recorded, as opposed to the trade date. */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
