import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';
import { Security } from '../entities/security.entity';

/** The kinds of corporate action Doni applies to holders' positions. */
export enum CorporateActionKind {
  SPLIT = 'split',
  REVERSE_SPLIT = 'reverse_split',
  FREE_SHARES = 'free_shares',
  RIGHTS_ISSUE = 'rights_issue',
}

/**
 * An issuer decision that changes the quantity or terms of a security held,
 * entered by an admin from its source BRVM notice and shared by all users.
 * The ratio reads "`ratioReceived` shares for every `ratioHeld`" (see the
 * ledger engine's `CorporateAction` for what that means per kind).
 */
@Entity('corporate_actions')
@Index(
  'UQ_corporate_actions_security_kind_date',
  ['securityId', 'kind', 'effectiveDate'],
  {
    unique: true,
  },
)
@Check(
  'CHK_corporate_actions_terms',
  `"ratioHeld" > 0 AND "ratioReceived" > 0 AND ("cashInLieuPrice" IS NULL OR "cashInLieuPrice" >= 0) AND ("subscriptionPrice" IS NULL OR "subscriptionPrice" >= 0)`,
)
export class CorporateAction extends BaseEntity {
  @Column({ type: 'uuid' })
  securityId: string;

  @ManyToOne(() => Security, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'securityId' })
  security?: Security;

  @Column({
    type: 'enum',
    enum: CorporateActionKind,
    enumName: 'corporate_action_kind_enum',
  })
  kind: CorporateActionKind;

  /** First trading day on the new basis (YYYY-MM-DD). */
  @Column({ type: 'date' })
  effectiveDate: string;

  @Column({ type: 'integer' })
  ratioHeld: number;

  @Column({ type: 'integer' })
  ratioReceived: number;

  /** Cash paid per new share for a fraction of a share, if the notice says. */
  @Column({ type: 'numeric', nullable: true })
  cashInLieuPrice: string | null;

  /** Price per new share of a rights issue; null for other kinds. */
  @Column({ type: 'numeric', nullable: true })
  subscriptionPrice: string | null;

  /** The BRVM notice the action was read from (its URL). */
  @Column({ type: 'text' })
  sourceNoticeUrl: string;
}
