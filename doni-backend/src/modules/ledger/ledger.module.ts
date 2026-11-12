import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Security } from '@modules/securities/entities/security.entity';
import { SecuritiesModule } from '@modules/securities/securities.module';
import { LedgerEntryRecord } from './entities/ledger-entry.entity';
import { Portfolio } from './entities/portfolio.entity';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';
import { PortfoliosUserData } from './portfolios-user-data';

/**
 * Portfolios, their append-only ledgers, and valuation. Positions are
 * derived by the pure ledger engine in `./engine`; prices come only from
 * the PriceSource.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Portfolio, LedgerEntryRecord, Security]),
    SecuritiesModule,
  ],
  controllers: [PortfoliosController],
  providers: [PortfoliosService, PortfoliosUserData],
})
export class LedgerModule {}
