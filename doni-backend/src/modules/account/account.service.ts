import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserDataRegistry } from '@common/user-data/user-data.registry';
import { ReauthenticationFailedError } from '@common/exceptions/auth.exceptions';
import { UsersService } from '@modules/users/users.service';
import { User } from '@modules/users/entities/user.entity';
import { AccountExportDto } from './dto/account.dto';

export const EXPORT_FORMAT = 'doni-account-export';
export const EXPORT_VERSION = 1;

/**
 * The user's control over their own data: export everything, or delete the
 * account and everything that belongs to it.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: UserDataRegistry,
    private readonly users: UsersService,
  ) {}

  /**
   * Every registered section of the user's data, read in one transaction so
   * the sections agree with each other.
   */
  async export(userId: string): Promise<AccountExportDto> {
    const sections = await this.dataSource.transaction(
      'REPEATABLE READ',
      async (manager) => {
        const result: Record<string, unknown> = {};
        for (const section of this.registry.sections()) {
          result[section.key] = await section.export(userId, manager);
        }
        return result;
      },
    );
    return {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      sections,
    };
  }

  /**
   * Deletes the account once the current password is confirmed. Everything
   * the user owns, sessions included, goes with the account row through
   * cascading foreign keys (checked by `uncoveredUserData`).
   */
  async delete(userId: string, password: string): Promise<void> {
    const user = await this.users.findOne(userId);
    if (!(await bcrypt.compare(password, user.password))) {
      throw new ReauthenticationFailedError();
    }
    await this.dataSource.manager.delete(User, { id: userId });
    this.logger.log(`Account deleted: ${userId}`);
  }
}
