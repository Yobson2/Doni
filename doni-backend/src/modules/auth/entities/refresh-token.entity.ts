import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';

/**
 * One refresh token issued to a session (ADR 0011). Only a hash of the token
 * is stored. Every refresh rotates the token: the old row is revoked and
 * points at its replacement. All tokens of one session share a family id, so
 * the whole session can be revoked at once.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  /** Also the `jti` claim of the token. */
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Index()
  @Column({ type: 'uuid' })
  familyId: string;

  /** SHA-256 of the token, hex encoded. */
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** The token this one was rotated into, if any. */
  @Column({ type: 'uuid', nullable: true })
  replacedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
