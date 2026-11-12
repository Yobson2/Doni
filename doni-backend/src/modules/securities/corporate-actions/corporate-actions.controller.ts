import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
  CorporateActionDto,
  CreateCorporateActionDto,
} from './corporate-action.dto';
import { CorporateActionsService } from './corporate-actions.service';

const ADMIN_ONLY = 'Admin role required';

/**
 * A security's corporate actions. Any signed-in user reads them, each with
 * its source BRVM notice; only an admin enters, corrects or removes them.
 */
@ApiTags('Catalogue')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiNotFoundResponse({ description: 'Unknown ticker or corporate action' })
@Controller('api/securities/:ticker/corporate-actions')
export class CorporateActionsController {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly corporateActions: CorporateActionsService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listCorporateActions',
    summary: 'Corporate actions on a security, oldest first',
  })
  @ApiOkResponse({ type: [CorporateActionDto] })
  async list(@Param('ticker') ticker: string): Promise<CorporateActionDto[]> {
    return this.corporateActions.list(
      await this.catalogue.findSecurity(ticker),
    );
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'createCorporateAction',
    summary: 'Enter a corporate action from its BRVM notice',
  })
  @ApiCreatedResponse({ type: CorporateActionDto })
  @ApiBadRequestResponse({ description: 'Terms do not fit the kind' })
  @ApiConflictResponse({ description: 'Same kind already on that date' })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  async create(
    @Param('ticker') ticker: string,
    @Body() dto: CreateCorporateActionDto,
  ): Promise<CorporateActionDto> {
    const security = await this.catalogue.findSecurity(ticker);
    return this.corporateActions.create(security, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'replaceCorporateAction',
    summary: 'Correct a corporate action',
  })
  @ApiOkResponse({ type: CorporateActionDto })
  @ApiBadRequestResponse({ description: 'Terms do not fit the kind' })
  @ApiConflictResponse({ description: 'Same kind already on that date' })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  async replace(
    @Param('ticker') ticker: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCorporateActionDto,
  ): Promise<CorporateActionDto> {
    const security = await this.catalogue.findSecurity(ticker);
    return this.corporateActions.replace(security, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'deleteCorporateAction',
    summary: 'Remove a corporate action entered by mistake',
  })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  async remove(
    @Param('ticker') ticker: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const security = await this.catalogue.findSecurity(ticker);
    await this.corporateActions.remove(security, id);
  }
}
