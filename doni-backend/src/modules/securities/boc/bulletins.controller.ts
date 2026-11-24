import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@common/constants/roles.constant';
import { GetUserId } from '@common/decorators/get-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { BocIngestionService } from './boc-ingestion.service';
import { BocReviewService } from './boc-review.service';
import {
  BulletinDateParamsDto,
  BulletinDto,
  BulletinSummaryDto,
  CorrectBulletinDto,
  IngestionResultDto,
  ListBulletinsQueryDto,
} from './bulletin.dto';

/**
 * Ingested BOCs (admin only): what was fetched and read each trading day,
 * and the review of days held as pending_review.
 */
@ApiTags('Bulletins')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
@Roles(UserRole.ADMIN)
@Controller('api/bulletins')
export class BulletinsController {
  constructor(
    private readonly ingestion: BocIngestionService,
    private readonly review: BocReviewService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listBulletins',
    summary: 'List ingested BOCs, newest first',
  })
  @ApiOkResponse({ type: [BulletinSummaryDto] })
  list(@Query() query: ListBulletinsQueryDto): Promise<BulletinSummaryDto[]> {
    return this.review.list(query.status);
  }

  @Get(':date')
  @ApiOperation({
    operationId: 'getBulletin',
    summary: 'Read one day’s BOC: rows read and failed checks',
  })
  @ApiOkResponse({ type: BulletinDto })
  @ApiNotFoundResponse({ description: 'No BOC stored for that day' })
  get(@Param() params: BulletinDateParamsDto): Promise<BulletinDto> {
    return this.review.get(params.date);
  }

  @Get(':date/document')
  @ApiOperation({
    operationId: 'getBulletinDocument',
    summary: 'Download the original BOC PDF',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'The PDF as downloaded' })
  @ApiNotFoundResponse({ description: 'No BOC stored for that day' })
  async document(
    @Param() params: BulletinDateParamsDto,
  ): Promise<StreamableFile> {
    const pdf = await this.review.document(params.date);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="boc_${params.date.replace(/-/g, '')}.pdf"`,
    });
  }

  @Post(':date/ingest')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'ingestBulletin',
    summary: 'Fetch and ingest that day’s BOC now (same as the daily job)',
  })
  @ApiOkResponse({ type: IngestionResultDto })
  ingest(@Param() params: BulletinDateParamsDto): Promise<IngestionResultDto> {
    return this.ingestion.ingest(params.date);
  }

  @Patch(':date')
  @ApiOperation({
    operationId: 'correctBulletin',
    summary: 'Correct misread values of a held day; checks run again',
  })
  @ApiOkResponse({ type: BulletinDto })
  @ApiNotFoundResponse({ description: 'No BOC stored for that day' })
  @ApiConflictResponse({ description: 'The day is already published' })
  correct(
    @Param() params: BulletinDateParamsDto,
    @Body() dto: CorrectBulletinDto,
  ): Promise<BulletinDto> {
    return this.review.correct(params.date, dto);
  }

  @Post(':date/publish')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'publishBulletin',
    summary: 'Publish a held day: its prices are shown from now on',
  })
  @ApiOkResponse({ type: BulletinDto })
  @ApiNotFoundResponse({ description: 'No BOC stored for that day' })
  @ApiConflictResponse({ description: 'The day is already published' })
  publish(
    @Param() params: BulletinDateParamsDto,
    @GetUserId() adminId: string,
  ): Promise<BulletinDto> {
    return this.review.publish(params.date, adminId);
  }
}
