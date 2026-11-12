import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
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
  CreatePortfolioDto,
  LedgerEntryDto,
  PortfolioDto,
  PortfolioValuationDto,
} from './dto/portfolio.dto';
import { PortfoliosService } from './portfolios.service';

const NOT_FOUND = 'No portfolio with that id belongs to you';

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
}
