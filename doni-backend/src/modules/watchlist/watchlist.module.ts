import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Security } from '@modules/securities/entities/security.entity';
import { SecuritiesModule } from '@modules/securities/securities.module';
import { WatchlistItem } from './entities/watchlist-item.entity';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';

/**
 * Securities each user follows without holding them, shown with their latest
 * end-of-day price from the PriceSource.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WatchlistItem, Security]),
    SecuritiesModule,
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
