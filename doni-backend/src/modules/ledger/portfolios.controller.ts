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
  CreateLedgerEntryDto,
  CreateOpeningPositionDto,
  CreatePortfolioDto,
  LedgerEntryDto,
  PortfolioDto,
  PortfolioValuationDto,
} from './dto/portfolio.dto';
import { PortfoliosService } from './portfolios.service';

const NOT_FOUND = 'No portfolio with that id belongs to you';
const ENTRY_NOT_FOUND =
  'No portfolio with that id belongs to you, or its ledger has no such entry of that kind (already corrected entries included)';

/**
 * The signed-in user's portfolios and their ledgers. A user only ever sees
 * and changes their own portfolios; anyone else's answers 404.
 */
@ApiTags('Portfolios')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('api/portfolios')
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  @Get()
  @ApiOperation({
    operationId: 'listPortfolios',
    summary: 'List my portfolios',
  })
  @ApiOkResponse({ type: [PortfolioDto] })
  list(@GetUserId() userId: string): Promise<PortfolioDto[]> {
    return this.portfolios.list(userId);
  }

  @Post()
  @ApiOperation({
    operationId: 'createPortfolio',
    summary: 'Create a portfolio',
  })
  @ApiCreatedResponse({ type: PortfolioDto })
  create(
    @GetUserId() userId: string,
    @Body() dto: CreatePortfolioDto,
  ): Promise<PortfolioDto> {
    return this.portfolios.create(userId, dto);
  }

  @Get(':id/valuation')
  @ApiOperation({
    operationId: 'getPortfolioValuation',
    summary:
      'Positions, PMP, realised and unrealised gains at the latest end-of-day prices',
  })
  @ApiOkResponse({ type: PortfolioValuationDto })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  valuation(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PortfolioValuationDto> {
    return this.portfolios.valuation(userId, id);
  }

  @Get(':id/entries')
  @ApiOperation({
    operationId: 'listLedgerEntries',
    summary: 'The portfolio’s ledger entries, oldest trade first',
  })
  @ApiOkResponse({ type: [LedgerEntryDto] })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  entries(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LedgerEntryDto[]> {
    return this.portfolios.listEntries(userId, id);
  }

  @Post(':id/entries')
  @ApiOperation({
    operationId: 'addLedgerEntry',
    summary: 'Record a buy or a sell, with its fees and SGI',
  })
  @ApiCreatedResponse({ type: LedgerEntryDto })
  @ApiBadRequestResponse({
    description: 'Invalid values, unknown ticker or a trade date after today',
  })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ApiUnprocessableEntityResponse({
    description: 'The sale exceeds the shares held at that date',
  })
  addEntry(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLedgerEntryDto,
  ): Promise<LedgerEntryDto> {
    return this.portfolios.addEntry(userId, id, dto);
  }

  @Post(':id/opening-positions')
  @ApiOperation({
    operationId: 'addOpeningPosition',
    summary:
      'Record an opening position: the quantity held and its PMP as of a date, instead of the past trades',
  })
  @ApiCreatedResponse({ type: LedgerEntryDto })
  @ApiBadRequestResponse({
    description: 'Invalid values, unknown ticker or a date after today',
  })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ApiUnprocessableEntityResponse({
    description:
      'A later sale would then exceed the shares held at its date, or an opening position for the security already has that date (edit it instead)',
  })
  addOpeningPosition(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOpeningPositionDto,
  ): Promise<LedgerEntryDto> {
    return this.portfolios.addOpeningPosition(userId, id, dto);
  }

  @Put(':id/entries/:entryId')
  @ApiOperation({
    operationId: 'editLedgerEntry',
    summary:
      'Correct a buy or a sell, however old: a new entry replaces it and the portfolio is recomputed',
  })
  @ApiOkResponse({ type: LedgerEntryDto, description: 'The new entry' })
  @ApiBadRequestResponse({
    description: 'Invalid values, unknown ticker or a trade date after today',
  })
  @ApiNotFoundResponse({ description: ENTRY_NOT_FOUND })
  @ApiUnprocessableEntityResponse({
    description:
      'With the correction, a sale at some date would exceed the shares then held',
  })
  editEntry(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: CreateLedgerEntryDto,
  ): Promise<LedgerEntryDto> {
    return this.portfolios.editEntry(userId, id, entryId, dto);
  }

  @Put(':id/opening-positions/:entryId')
  @ApiOperation({
    operationId: 'editOpeningPosition',
    summary:
      'Correct an opening position: a new entry replaces it and the portfolio is recomputed',
  })
  @ApiOkResponse({ type: LedgerEntryDto, description: 'The new entry' })
  @ApiBadRequestResponse({
    description: 'Invalid values, unknown ticker or a date after today',
  })
  @ApiNotFoundResponse({ description: ENTRY_NOT_FOUND })
  @ApiUnprocessableEntityResponse({
    description:
      'A later sale would then exceed the shares held, or another opening position for the security has that date',
  })
  editOpeningPosition(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: CreateOpeningPositionDto,
  ): Promise<LedgerEntryDto> {
    return this.portfolios.editOpeningPosition(userId, id, entryId, dto);
  }

  @Delete(':id/entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'deleteLedgerEntry',
    summary:
      'Delete a ledger entry of any kind: it stops counting and the portfolio is recomputed',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: ENTRY_NOT_FOUND })
  @ApiUnprocessableEntityResponse({
    description:
      'Without the entry, a sale at some date would exceed the shares then held',
  })
  deleteEntry(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ): Promise<void> {
    return this.portfolios.deleteEntry(userId, id, entryId);
  }
}
