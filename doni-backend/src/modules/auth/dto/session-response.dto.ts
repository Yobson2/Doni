import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

/**
 * Returned by sign-up, sign-in and refresh. The refresh token is never in
 * the body: it travels only in the httpOnly session cookie.
 */
export class SessionResponseDto {
  @ApiProperty({ description: 'Short-lived bearer token; keep in memory' })
  accessToken: string;

  @ApiProperty({ description: 'Seconds until the access token expires' })
  expiresIn: number;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
