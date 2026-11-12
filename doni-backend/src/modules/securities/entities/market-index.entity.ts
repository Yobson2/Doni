import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';

/** A BRVM index published in the BOC, e.g. BRVM-C (BRVM Composite). */
@Entity('market_indices')
export class MarketIndex extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;
}
