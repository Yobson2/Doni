import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUserId } from '@common/decorators/get-user.decorator';
import { PortfolioReturnsDto, ReturnsQueryDto } from './dto/returns.dto';
import { ReturnsService } from './returns.service';

/** The returns of the signed-in user's portfolio (ADR 0007). */
@ApiTags('Portfolios')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('api/portfolios/:id/returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @ApiOperation({
    operationId: 'getPortfolioReturns',
    summary:
      'Mon rendement (XIRR) and the portfolio TWR against the BRVM Composite over a period, with the days on which data is missing',
  })
  @ApiOkResponse({ type: PortfolioReturnsDto })
  @ApiBadRequestResponse({ description: 'Unknown period' })
  @ApiNotFoundResponse({
    description: 'No portfolio with that id belongs to you',
  })
  get(
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReturnsQueryDto,
  ): Promise<PortfolioReturnsDto> {
    return this.returns.returns(userId, id, query.period ?? 'ALL');
  }
}
