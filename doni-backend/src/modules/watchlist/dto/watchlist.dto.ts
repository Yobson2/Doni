import { ApiProperty } from '@nestjs/swagger';
import { EndOfDayPriceDto } from '@modules/securities/dto/price.dto';

/** A security on the user's watchlist, with its latest end-of-day price. */
export class WatchlistItemDto {
  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ example: 'SONATEL SN' })
  name: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When the user added the security',
  })
  addedAt: string;

  @ApiProperty({
    type: EndOfDayPriceDto,
    nullable: true,
    description:
      'Most recent published end-of-day price, with the date it applies to; null when there is none',
  })
  latestPrice: EndOfDayPriceDto | null;
}
