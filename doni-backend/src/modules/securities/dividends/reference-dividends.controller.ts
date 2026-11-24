import {
  Body,
  Controller,
  Get,
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@common/constants/roles.constant';
import { Roles } from '@common/decorators/roles.decorator';
import { CatalogueService } from '../catalogue.service';
import {
  CreateReferenceDividendDto,
  ReferenceDividendDto,
} from './reference-dividend.dto';
import { ReferenceDividendsService } from './reference-dividends.service';

const ADMIN_ONLY = 'Admin role required';

/**
 * A security's reference dividends. Any signed-in user reads them, each
 * with its source notice; only an admin enters or corrects them.
 */
@ApiTags('Catalogue')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiNotFoundResponse({ description: 'Unknown ticker or reference dividend' })
@Controller('api/securities/:ticker/dividends')
export class ReferenceDividendsController {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly dividends: ReferenceDividendsService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listReferenceDividends',
    summary: 'Dividends declared on a security, by ex-date, oldest first',
  })
  @ApiOkResponse({ type: [ReferenceDividendDto] })
  async list(@Param('ticker') ticker: string): Promise<ReferenceDividendDto[]> {
    return this.dividends.list(await this.catalogue.findSecurity(ticker));
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'createReferenceDividend',
    summary: 'Enter a declared dividend from its notice',
  })
  @ApiCreatedResponse({ type: ReferenceDividendDto })
  @ApiBadRequestResponse({
    description: 'Invalid values, or a payment date before the ex-date',
  })
  @ApiConflictResponse({ description: 'A dividend already has that ex-date' })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  async create(
    @Param('ticker') ticker: string,
    @Body() dto: CreateReferenceDividendDto,
  ): Promise<ReferenceDividendDto> {
    const security = await this.catalogue.findSecurity(ticker);
    return this.dividends.create(security, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'replaceReferenceDividend',
    summary:
      'Correct a declared dividend: suggestions follow, confirmed user dividends keep their amounts',
  })
  @ApiOkResponse({ type: ReferenceDividendDto })
  @ApiBadRequestResponse({
    description: 'Invalid values, or a payment date before the ex-date',
  })
  @ApiConflictResponse({ description: 'A dividend already has that ex-date' })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  async replace(
    @Param('ticker') ticker: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReferenceDividendDto,
  ): Promise<ReferenceDividendDto> {
    const security = await this.catalogue.findSecurity(ticker);
    return this.dividends.replace(security, id, dto);
  }
}
