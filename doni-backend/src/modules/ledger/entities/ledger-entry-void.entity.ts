import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { LedgerEntryRecord } from './ledger-entry.entity';

/**
 * A correction of the ledger (ADR 0004): the ledger entry `entryId` no
 * longer counts, from `createdAt` on. With a `replacementId`, the user
 * edited it and that newer entry takes its place; without one, the user
 * deleted it. Like ledger entries, rows are only ever inserted (the
 * database rejects any UPDATE), so the ledger's full history, including
 * what was corrected and when, stays readable.
 */
@Entity('ledger_entry_voids')
@Check(
  'CHK_ledger_entry_voids_not_itself',
  `"replacementId" IS NULL OR "replacementId" <> "entryId"`,
)
export class LedgerEntryVoid {
  /** The entry voided; an entry is voided at most once. */
  @PrimaryColumn({ type: 'uuid' })
  entryId: string;

  @ManyToOne(() => LedgerEntryRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entryId' })
  entry?: LedgerEntryRecord;

  /** The entry that replaces it, when it was edited rather than deleted. */
  @Column({ type: 'uuid', nullable: true, unique: true })
  replacementId: string | null;

  @ManyToOne(() => LedgerEntryRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'replacementId' })
  replacement?: LedgerEntryRecord;

  /** When the correction was recorded. */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
