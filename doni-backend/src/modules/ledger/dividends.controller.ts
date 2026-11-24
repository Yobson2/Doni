import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { GetUserId } from '@common/decorators/get-user.decorator';
import {
  ConfirmDividendDto,
  DividendCalendarItemDto,
} from './dto/dividend.dto';
import { LedgerEntryDto } from './dto/portfolio.dto';
import { DividendsService } from './dividends.service';

const NOT_SUGGESTED =
  'No portfolio with that id belongs to you, or it has no suggestion from that reference dividend (no shares held at its ex-date, or the ex-date is still to come)';

/**
 * The dividend calendar of the signed-in user's portfolio, and what the user
 * does with each suggestion: confirm the net amount received, or dismiss it.
 */
@ApiTags('Portfolios')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('api/portfolios/:id/dividends')
export class DividendsController {
  constructor(private readonly dividends: DividendsService) {}

  @Get()
  @ApiOperation({
    operationId: 'getDividendCalendar',
    summary:
      'Upcoming and past dividends on the securities held, with their suggestion or confirmed amount, by payment date',
  })
  @ApiOkResponse({ type: [DividendCalendarItemDto] })
  @ApiNotFoundResponse({
    description: 'No portfolio with that id belongs to you',
  })
  calendar(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DividendCalendarItemDto[]> {
    return this.dividends.calendar(userId, id);
  }

  @Post(':referenceDividendId/confirmation')
  @ApiOperation({
    operationId: 'confirmDividend',
    summary:
      'Confirm the net amount received for a suggested dividend: it is recorded in the ledger as a user dividend',
  })
  @ApiCreatedResponse({ type: LedgerEntryDto })
  @ApiBadRequestResponse({ description: 'Invalid amount or SGI' })
  @ApiNotFoundResponse({ description: NOT_SUGGESTED })
  @ApiConflictResponse({ description: 'This dividend is already recorded' })
  @ApiUnprocessableEntityResponse({
    description: 'The dividend is not paid yet',
  })
  confirm(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('referenceDividendId', ParseUUIDPipe) referenceDividendId: string,
    @Body() dto: ConfirmDividendDto,
  ): Promise<LedgerEntryDto> {
    return this.dividends.confirm(userId, id, referenceDividendId, dto);
  }

  @Put(':referenceDividendId/dismissal')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'dismissDividend',
    summary:
      'Dismiss a dividend suggestion: it stays listed as dismissed and counts nowhere',
  })
  @ApiNoContentResponse({ description: 'Dismissed' })
  @ApiNotFoundResponse({ description: NOT_SUGGESTED })
  @ApiConflictResponse({ description: 'This dividend is already recorded' })
  dismiss(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('referenceDividendId', ParseUUIDPipe) referenceDividendId: string,
  ): Promise<void> {
    return this.dividends.dismiss(userId, id, referenceDividendId);
  }

  @Delete(':referenceDividendId/dismissal')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'restoreDividend',
    summary: 'Undo a dismissal: the suggestion shows again',
  })
  @ApiNoContentResponse({ description: 'Restored, or was not dismissed' })
  @ApiNotFoundResponse({
    description: 'No portfolio with that id belongs to you',
  })
  restore(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('referenceDividendId', ParseUUIDPipe) referenceDividendId: string,
  ): Promise<void> {
    return this.dividends.restore(userId, id, referenceDividendId);
  }
}
