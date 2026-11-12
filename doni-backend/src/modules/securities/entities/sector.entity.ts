import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';

/** A BRVM sector (e.g. TEL, FIN), named in both app languages. */
@Entity('sectors')
export class Sector extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  nameFr: string;

  @Column()
  nameEn: string;
}
