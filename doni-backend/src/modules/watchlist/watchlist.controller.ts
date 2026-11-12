import { Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUserId } from '@common/decorators/get-user.decorator';
import { WatchlistItemDto } from './dto/watchlist.dto';
import { WatchlistService } from './watchlist.service';

/**
 * The signed-in user's watchlist: securities they follow without holding
 * them. There is no way to address anyone else's watchlist.
 */
@ApiTags('Watchlist')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('api/watchlist')
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get()
  @ApiOperation({
    operationId: 'listWatchlist',
    summary:
      'My watched securities with their latest end-of-day price and its date',
  })
  @ApiOkResponse({ type: [WatchlistItemDto] })
  list(@GetUserId() userId: string): Promise<WatchlistItemDto[]> {
    return this.watchlist.list(userId);
  }

  @Put(':ticker')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'addToWatchlist',
    summary: 'Watch a security (no change if already watched)',
  })
  @ApiOkResponse({ type: WatchlistItemDto })
  @ApiNotFoundResponse({ description: 'Unknown ticker' })
  add(
    @GetUserId() userId: string,
    @Param('ticker') ticker: string,
  ): Promise<WatchlistItemDto> {
    return this.watchlist.add(userId, ticker);
  }

  @Delete(':ticker')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'removeFromWatchlist',
    summary: 'Stop watching a security (no change if not watched)',
  })
  @ApiNoContentResponse({ description: 'The security is no longer watched' })
  @ApiNotFoundResponse({ description: 'Unknown ticker' })
  remove(
    @GetUserId() userId: string,
    @Param('ticker') ticker: string,
  ): Promise<void> {
    return this.watchlist.remove(userId, ticker);
  }
}
