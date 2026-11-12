import { Module } from '@nestjs/common';
import { UsersModule } from '@modules/users/users.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

/**
 * Export and deletion of the signed-in user's data. The export is assembled
 * from the sections each module registers with the UserDataRegistry.
 */
@Module({
  imports: [UsersModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
