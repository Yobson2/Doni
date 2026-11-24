import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketIndex } from '@modules/securities/entities/market-index.entity';
import { Security } from '@modules/securities/entities/security.entity';
import { SecuritiesModule } from '@modules/securities/securities.module';
import { DividendsController } from './dividends.controller';
import { DividendsService } from './dividends.service';
import { DividendDismissal } from './entities/dividend-dismissal.entity';
import { LedgerEntryVoid } from './entities/ledger-entry-void.entity';
import { LedgerEntryRecord } from './entities/ledger-entry.entity';
import { Portfolio } from './entities/portfolio.entity';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';
import { PortfoliosUserData } from './portfolios-user-data';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

/**
 * Portfolios, their append-only ledgers, valuation, the dividend calendar
 * (suggestions derived from reference dividends, confirmed into the ledger
 * as user dividends), and returns (XIRR, TWR against the BRVM Composite).
 * Positions are derived by the pure ledger engine in `./engine`; prices
 * come only from the PriceSource.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Portfolio,
      LedgerEntryRecord,
      LedgerEntryVoid,
      DividendDismissal,
      Security,
      MarketIndex,
    ]),
    SecuritiesModule,
  ],
  controllers: [PortfoliosController, DividendsController, ReturnsController],
  providers: [
    PortfoliosService,
    DividendsService,
    ReturnsService,
    PortfoliosUserData,
  ],
})
export class LedgerModule {}
