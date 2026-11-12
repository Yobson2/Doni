import { Injectable, OnModuleInit } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  UserDataRegistry,
  UserDataSection,
} from '@common/user-data/user-data.registry';
import type { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';

/** The `account` section of the user data export: the profile, no password. */
@Injectable()
export class AccountUserData implements UserDataSection, OnModuleInit {
  readonly key = 'account';
  readonly entities = [User];

  constructor(private readonly registry: UserDataRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async export(
    userId: string,
    manager: EntityManager,
  ): Promise<UserResponseDto> {
    return (await manager.findOneByOrFail(User, { id: userId })).toResponse();
  }
}
