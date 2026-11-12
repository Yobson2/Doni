import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';
import { Sector } from './sector.entity';

/** The language a company profile was written in; the other is a translation. */
export enum ProfileLanguage {
  FR = 'fr',
  EN = 'en',
}

/** A security listed on the BRVM (in the MVP, a listed share). */
@Entity('securities')
export class Security extends BaseEntity {
  /** The BRVM symbol, e.g. SNTS. */
  @Column({ unique: true })
  ticker: string;

  @Column()
  name: string;

  @Column({ type: 'char', length: 12, nullable: true, unique: true })
  isin: string | null;

  @Column({ type: 'uuid' })
  sectorId: string;

  @ManyToOne(() => Sector, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sectorId' })
  sector: Sector;

  /** ISO 3166-1 alpha-2 code of the issuer's country, e.g. SN. */
  @Column({ type: 'char', length: 2 })
  country: string;

  @Column({ type: 'text', nullable: true })
  profileFr: string | null;

  @Column({ type: 'text', nullable: true })
  profileEn: string | null;

  @Column({
    type: 'enum',
    enum: ProfileLanguage,
    enumName: 'profile_language_enum',
    default: ProfileLanguage.FR,
  })
  profileOriginalLanguage: ProfileLanguage;
}
