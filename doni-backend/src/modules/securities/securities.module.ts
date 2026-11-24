import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '@common/mail/mail.module';
import { User } from '@modules/users/entities/user.entity';
import { BocBulletin } from './boc/boc-bulletin.entity';
import { BOC_FETCHER, HttpBocFetcher } from './boc/boc-fetcher';
import { BocIngestionJob } from './boc/boc-ingestion.job';
import { BocIngestionService } from './boc/boc-ingestion.service';
import { BocNotifier } from './boc/boc-notifier';
import { BocParser } from './boc/boc-parser';
import { BocReviewService } from './boc/boc-review.service';
import { BulletinsController } from './boc/bulletins.controller';
import { CatalogueService } from './catalogue.service';
import { CorporateAction } from './corporate-actions/corporate-action.entity';
import { CorporateActionsController } from './corporate-actions/corporate-actions.controller';
import { CorporateActionsService } from './corporate-actions/corporate-actions.service';
import { EodPrice } from './entities/eod-price.entity';
import { MarketIndex } from './entities/market-index.entity';
import { Sector } from './entities/sector.entity';
import { Security } from './entities/security.entity';
import { DatabasePriceSource } from './prices/database-price-source';
import { PriceEntryService } from './prices/price-entry.service';
import { PRICE_DOCUMENT_PARSER, PRICE_SOURCE } from './prices/price-source';
import {
  IndicesController,
  SecuritiesController,
  SectorsController,
} from './securities.controller';

/**
 * The securities catalogue and its end-of-day prices, including the daily
 * BOC ingestion that feeds them. Other modules that need prices import this
 * module and inject `PRICE_SOURCE`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sector,
      Security,
      MarketIndex,
      EodPrice,
      CorporateAction,
      BocBulletin,
      User,
    ]),
    MailModule,
  ],
  controllers: [
    SectorsController,
    SecuritiesController,
    IndicesController,
    CorporateActionsController,
    BulletinsController,
  ],
  providers: [
    CatalogueService,
    PriceEntryService,
    CorporateActionsService,
    { provide: PRICE_SOURCE, useClass: DatabasePriceSource },
    // Daily BOC ingestion (the write side of the PriceSource).
    { provide: PRICE_DOCUMENT_PARSER, useClass: BocParser },
    { provide: BOC_FETCHER, useClass: HttpBocFetcher },
    BocNotifier,
    BocIngestionService,
    BocReviewService,
    BocIngestionJob,
  ],
  exports: [PRICE_SOURCE, CorporateActionsService],
})
export class SecuritiesModule {}
