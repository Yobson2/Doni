import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { GetUserId } from '@common/decorators/get-user.decorator';
import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_OPTIONS,
} from '@common/config/auth.config';
import { AccountService } from './account.service';
import { AccountExportDto, DeleteAccountDto } from './dto/account.dto';

/** The signed-in user's own data: export and account deletion. */
@ApiTags('Account')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('api/account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('export')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    operationId: 'exportMyData',
    summary: 'Download all my data as JSON',
  })
  @ApiOkResponse({ type: AccountExportDto })
  async export(
    @GetUserId() userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountExportDto> {
    const data = await this.account.export(userId);
    const day = data.exportedAt.slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="doni-export-${day}.json"`,
    );
    return data;
  }

  @Post('deletion')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Few attempts: each one checks the password.
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    operationId: 'deleteMyAccount',
    summary: 'Delete my account and all my data',
    description:
      'Requires the current password. Deletes the account, its portfolios ' +
      'and ledgers, watchlist and every other section of the export, and ' +
      'ends every session. Cannot be undone.',
  })
  @ApiNoContentResponse({
    description: 'Account deleted; the refresh cookie is cleared',
  })
  @ApiBadRequestResponse({ description: 'Password missing' })
  @ApiForbiddenResponse({ description: 'Password confirmation failed' })
  async delete(
    @GetUserId() userId: string,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.account.delete(userId, dto.password);
    res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
  }
}
