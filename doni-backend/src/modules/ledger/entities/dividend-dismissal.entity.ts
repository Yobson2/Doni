import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ReferenceDividend } from '@modules/securities/dividends/reference-dividend.entity';
import { Portfolio } from './portfolio.entity';

/**
 * The user dismissed the dividend suggestion a reference dividend gives a
 * portfolio (for instance, the dividend went to another account). Not a
 * ledger entry: it only hides the suggestion, and can be undone.
 * Suggestions themselves are never stored; they are derived on read.
 */
@Entity('dividend_dismissals')
export class DividendDismissal {
  @PrimaryColumn({ type: 'uuid' })
  portfolioId: string;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolioId' })
  portfolio?: Portfolio;

  @PrimaryColumn({ type: 'uuid' })
  referenceDividendId: string;

  @ManyToOne(() => ReferenceDividend, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referenceDividendId' })
  referenceDividend?: ReferenceDividend;

  /** When the suggestion was dismissed. */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
