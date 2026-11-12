import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** What a user may change on their own account. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Awa' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Traoré' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

/** What an admin may change on any account. */
export class UpdateUserDto extends UpdateProfileDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
