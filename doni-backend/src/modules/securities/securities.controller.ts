import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/constants/roles.constant';
import { CatalogueService } from './catalogue.service';
import {
  CreateMarketIndexDto,
  CreateSectorDto,
  CreateSecurityDto,
  MarketIndexDto,
  SectorDto,
  SecurityDto,
  UpdateSecurityDto,
  UpdateSectorDto,
} from './dto/catalogue.dto';
import {
  EndOfDayPriceDto,
  IndexPriceDayParamsDto,
  PriceHistoryQueryDto,
  PutPriceDto,
  SecurityPriceDayParamsDto,
  StoredPriceDto,
} from './dto/price.dto';
import { PriceEntryService } from './prices/price-entry.service';
import { PRICE_SOURCE, type PriceSource } from './prices/price-source';

const ADMIN_ONLY = 'Admin role required';

/**
 * Sectors. Any signed-in user reads them; only an admin changes them.
 */
@ApiTags('Catalogue')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('api/sectors')
export class SectorsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({ operationId: 'listSectors', summary: 'List sectors' })
  @ApiOkResponse({ type: [SectorDto] })
  list(): Promise<SectorDto[]> {
    return this.catalogue.listSectors();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ operationId: 'createSector', summary: 'Add a sector' })
  @ApiCreatedResponse({ type: SectorDto })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  create(@Body() dto: CreateSectorDto): Promise<SectorDto> {
    return this.catalogue.createSector(dto);
  }

  @Patch(':code')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ operationId: 'updateSector', summary: 'Rename a sector' })
  @ApiOkResponse({ type: SectorDto })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  update(
    @Param('code') code: string,
    @Body() dto: UpdateSectorDto,
  ): Promise<SectorDto> {
    return this.catalogue.updateSector(code, dto);
  }
}

/**
 * Listed securities and their end-of-day prices. Any signed-in user reads
 * them; only an admin changes the catalogue or enters prices. Prices are
 * read through the PriceSource, so they are always published ones.
 */
@ApiTags('Catalogue')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('api/securities')
export class SecuritiesController {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly priceEntry: PriceEntryService,
    @Inject(PRICE_SOURCE) private readonly priceSource: PriceSource,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listSecurities',
    summary: 'List securities with their latest end-of-day price',
  })
  @ApiOkResponse({ type: [SecurityDto] })
  list(): Promise<SecurityDto[]> {
    return this.catalogue.listSecurities();
  }

  @Get(':ticker')
  @ApiOperation({ operationId: 'getSecurity', summary: 'Read a security' })
  @ApiOkResponse({ type: SecurityDto })
  @ApiNotFoundResponse({ description: 'Unknown ticker' })
  get(@Param('ticker') ticker: string): Promise<SecurityDto> {
    return this.catalogue.getSecurity(ticker);
  }

  @Get(':ticker/prices')
  @ApiOperation({
    operationId: 'getSecurityPrices',
    summary: 'End-of-day price history, oldest first',
  })
  @ApiOkResponse({ type: [EndOfDayPriceDto] })
  @ApiNotFoundResponse({ description: 'Unknown ticker' })
  async history(
    @Param('ticker') ticker: string,
    @Query() range: PriceHistoryQueryDto,
  ): Promise<EndOfDayPriceDto[]> {
    const security = await this.catalogue.findSecurity(ticker);
    return this.priceSource.getHistory({ securityId: security.id }, range);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ operationId: 'createSecurity', summary: 'Add a security' })
  @ApiCreatedResponse({ type: SecurityDto })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  create(@Body() dto: CreateSecurityDto): Promise<SecurityDto> {
    return this.catalogue.createSecurity(dto);
  }

  @Patch(':ticker')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ operationId: 'updateSecurity', summary: 'Edit a security' })
  @ApiOkResponse({ type: SecurityDto })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  update(
    @Param('ticker') ticker: string,
    @Body() dto: UpdateSecurityDto,
  ): Promise<SecurityDto> {
    return this.catalogue.updateSecurity(ticker, dto);
  }

  @Put(':ticker/prices/:date')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'putSecurityPrice',
    summary: 'Enter or correct one day’s end-of-day price from a BOC',
  })
  @ApiOkResponse({ type: StoredPriceDto })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  @ApiNotFoundResponse({ description: 'Unknown ticker' })
  async putPrice(
    @Param() params: SecurityPriceDayParamsDto,
    @Body() dto: PutPriceDto,
  ): Promise<StoredPriceDto> {
    const security = await this.catalogue.findSecurity(params.ticker);
    return this.priceEntry.put({ securityId: security.id }, params.date, dto);
  }
}

/** BRVM indices and their daily values, from the same PriceSource. */
@ApiTags('Catalogue')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('api/indices')
export class IndicesController {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly priceEntry: PriceEntryService,
    @Inject(PRICE_SOURCE) private readonly priceSource: PriceSource,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listIndices', summary: 'List indices' })
  @ApiOkResponse({ type: [MarketIndexDto] })
  list(): Promise<MarketIndexDto[]> {
    return this.catalogue.listIndices();
  }

  @Get(':code/prices')
  @ApiOperation({
    operationId: 'getIndexPrices',
    summary: 'Index value history, oldest first',
  })
  @ApiOkResponse({ type: [EndOfDayPriceDto] })
  @ApiNotFoundResponse({ description: 'Unknown index' })
  async history(
    @Param('code') code: string,
    @Query() range: PriceHistoryQueryDto,
  ): Promise<EndOfDayPriceDto[]> {
    const index = await this.catalogue.findIndex(code);
    return this.priceSource.getHistory({ indexId: index.id }, range);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ operationId: 'createIndex', summary: 'Add an index' })
  @ApiCreatedResponse({ type: MarketIndexDto })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  create(@Body() dto: CreateMarketIndexDto): Promise<MarketIndexDto> {
    return this.catalogue.createIndex(dto);
  }

  @Put(':code/prices/:date')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'putIndexPrice',
    summary: 'Enter or correct one day’s index value from a BOC',
  })
  @ApiOkResponse({ type: StoredPriceDto })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  @ApiNotFoundResponse({ description: 'Unknown index' })
  async putPrice(
    @Param() params: IndexPriceDayParamsDto,
    @Body() dto: PutPriceDto,
  ): Promise<StoredPriceDto> {
    const index = await this.catalogue.findIndex(params.code);
    return this.priceEntry.put({ indexId: index.id }, params.date, dto);
  }
}
