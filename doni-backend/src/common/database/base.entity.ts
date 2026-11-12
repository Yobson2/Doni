import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  protected _hidden: string[] = [];

  toJSON(): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};

    Object.entries(this).forEach(([key, value]) => {
      if (!this._hidden.includes(key) && key !== '_hidden') {
        filtered[key] = value instanceof Date ? value.toISOString() : value;
      }
    });

    return filtered;
  }
}
