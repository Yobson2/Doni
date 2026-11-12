import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';
import { UserRole } from '@common/constants/roles.constant';
import type { UserResponseDto } from '../dto/user-response.dto';

/**
 * The currency a user sees amounts in (ADR 0008). Amounts are always stored
 * and computed in XOF; EUR is a display conversion at the peg rate.
 */
export enum DisplayCurrency {
  XOF = 'XOF',
  EUR = 'EUR',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBRE,
    enumName: 'user_role_enum',
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: DisplayCurrency,
    enumName: 'display_currency_enum',
    default: DisplayCurrency.XOF,
  })
  displayCurrency: DisplayCurrency;

  protected _hidden = ['password'];

  /** The account as the API returns it. */
  toResponse(): UserResponseDto {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      isActive: this.isActive,
      displayCurrency: this.displayCurrency,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
