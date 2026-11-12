import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto, UpdateUserDto } from './dto/update-user.dto';
import { UserListResponseDto, UserResponseDto } from './dto/user-response.dto';
import { PaginationQueryDto } from '@common/dto/pagination.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetUserId } from '@common/decorators/get-user.decorator';
import { UserRole } from '@common/constants/roles.constant';

/**
 * Accounts. A user reads and updates only their own account (`/me`);
 * every other route is account administration and requires the admin role.
 * Accounts are created only through sign-up (`POST /api/auth/sign-up`).
 */
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ operationId: 'getMe', summary: 'Read my account' })
  @ApiOkResponse({ type: UserResponseDto })
  async getMe(@GetUserId() userId: string): Promise<UserResponseDto> {
    return (await this.usersService.findOne(userId)).toResponse();
  }

  @Patch('me')
  @ApiOperation({ operationId: 'updateMe', summary: 'Update my account' })
  @ApiOkResponse({ type: UserResponseDto })
  async updateMe(
    @GetUserId() userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return (await this.usersService.update(userId, dto)).toResponse();
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ operationId: 'listUsers', summary: 'List accounts (admin)' })
  @ApiOkResponse({ type: UserListResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<UserListResponseDto> {
    const page = await this.usersService.findAll(query);
    return { data: page.data.map((u) => u.toResponse()), meta: page.meta };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ operationId: 'getUser', summary: 'Read an account (admin)' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return (await this.usersService.findOne(id)).toResponse();
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'updateUser',
    summary: 'Update an account (admin)',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return (await this.usersService.update(id, dto)).toResponse();
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'deactivateUser',
    summary: 'Deactivate an account (admin)',
  })
  @ApiOkResponse({ description: 'Account deactivated' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
