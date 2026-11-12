import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';
import { User } from '@modules/users/entities/user.entity';

/**
 * A user's portfolio. It holds no positions itself: they are derived by
 * replaying its ledger (ADR 0004). Only its owner can see or change it.
 */
@Entity('portfolios')
export class Portfolio extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner?: User;

  @Column({ type: 'varchar', length: 100 })
  name: string;
}
