import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@common/constants/roles.constant';
import { PaginationMetaDto } from '@common/dto/pagination.dto';

/** A user account as the API returns it (never includes the password). */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: 'Awa' })
  firstName: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Traoré' })
  lastName: string | null;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
