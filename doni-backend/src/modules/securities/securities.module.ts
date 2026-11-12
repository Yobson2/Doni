import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogueService } from './catalogue.service';
import { EodPrice } from './entities/eod-price.entity';
import { MarketIndex } from './entities/market-index.entity';
import { Sector } from './entities/sector.entity';
import { Security } from './entities/security.entity';
import { DatabasePriceSource } from './prices/database-price-source';
import { PriceEntryService } from './prices/price-entry.service';
import { PRICE_SOURCE } from './prices/price-source';
import {
  IndicesController,
  SecuritiesController,
  SectorsController,
} from './securities.controller';

/**
 * The securities catalogue and its end-of-day prices. Other modules that need
 * prices import this module and inject `PRICE_SOURCE`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Sector, Security, MarketIndex, EodPrice]),
  ],
  controllers: [SectorsController, SecuritiesController, IndicesController],
  providers: [
    CatalogueService,
    PriceEntryService,
    { provide: PRICE_SOURCE, useClass: DatabasePriceSource },
  ],
  exports: [PRICE_SOURCE],
})
export class SecuritiesModule {}
