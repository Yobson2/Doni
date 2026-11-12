import {
  CreateDateColumn,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Security } from '@modules/securities/entities/security.entity';
import { User } from '@modules/users/entities/user.entity';

/**
 * A security a user follows without necessarily holding it. A user watches a
 * security at most once; only that user ever sees the item.
 */
@Entity('watchlist_items')
@Index('UQ_watchlist_items_user_security', ['userId', 'securityId'], {
  unique: true,
})
export class WatchlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid' })
  securityId: string;

  @ManyToOne(() => Security, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'securityId' })
  security?: Security;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
