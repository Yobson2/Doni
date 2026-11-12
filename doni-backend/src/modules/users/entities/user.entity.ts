import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';
import { UserRole } from '@common/constants/roles.constant';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

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
}
