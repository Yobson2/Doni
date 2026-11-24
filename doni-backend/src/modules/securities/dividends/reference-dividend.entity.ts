import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';
import { Security } from '../entities/security.entity';

/**
 * A reference dividend: the dividend an issuer declares for a security,
 * entered once by an admin from its source notice and shared by all users.
 * Holders get a suggestion from it (shares held at the ex-date × gross per
 * share); only the net amount a user confirms enters their ledger.
 */
@Entity('reference_dividends')
@Index('UQ_reference_dividends_security_ex_date', ['securityId', 'exDate'], {
  unique: true,
})
@Check(
  'CHK_reference_dividends_terms',
  `"grossPerShare" > 0 AND "paymentDate" >= "exDate"`,
)
export class ReferenceDividend extends BaseEntity {
  @Column({ type: 'uuid' })
  securityId: string;

  @ManyToOne(() => Security, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'securityId' })
  security?: Security;

  /** Gross amount per share, XOF. */
  @Column({ type: 'numeric' })
  grossPerShare: string;

  /**
   * First trading day without the dividend (YYYY-MM-DD): shares held at
   * the close of the day before earn it.
   */
  @Column({ type: 'date' })
  exDate: string;

  /** The day the dividend is paid (YYYY-MM-DD), on or after the ex-date. */
  @Column({ type: 'date' })
  paymentDate: string;

  /** The notice the dividend was read from (its URL). */
  @Column({ type: 'text' })
  sourceNoticeUrl: string;
}
