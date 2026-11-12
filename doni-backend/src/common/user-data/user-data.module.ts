import { Global, Module } from '@nestjs/common';
import { UserDataRegistry } from './user-data.registry';

/** Provides the registry every module adds its user data section to. */
@Global()
@Module({
  providers: [UserDataRegistry],
  exports: [UserDataRegistry],
})
export class UserDataModule {}
