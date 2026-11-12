import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';
import { UserRole } from '@common/constants/roles.constant';
import type { UserResponseDto } from '../dto/user-response.dto';

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
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
