import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  BulletinNotFoundError,
  BulletinNotHeldError,
  BulletinUnknownRowError,
} from '@common/exceptions/catalogue.exceptions';
import { EodPrice } from '../entities/eod-price.entity';
import { MarketIndex } from '../entities/market-index.entity';
import { PriceStatus } from '../entities/price-status';
import { Security } from '../entities/security.entity';
import { BocBulletin } from './boc-bulletin.entity';
import { runChecks } from './boc-checks';
import { BocIngestionService } from './boc-ingestion.service';
import type {
  BulletinDto,
  BulletinSummaryDto,
  CorrectBulletinDto,
} from './bulletin.dto';

/**
 * The admin side of ingestion: list stored bulletins, inspect a held day,
 * correct what was misread, and publish it.
 */
@Injectable()
export class BocReviewService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ingestion: BocIngestionService,
  ) {}

  async list(status?: PriceStatus): Promise<BulletinSummaryDto[]> {
    const bulletins = await this.dataSource.getRepository(BocBulletin).find({
      where: status ? { status } : {},
      order: { tradingDate: 'DESC' },
      take: 200,
    });
    return bulletins.map(toSummary);
  }

  async get(tradingDate: string): Promise<BulletinDto> {
    return this.toDetail(
      this.dataSource.manager,
      await this.find(this.dataSource.manager, tradingDate),
    );
  }

  /** The original PDF, exactly as downloaded. */
  async document(tradingDate: string): Promise<Buffer> {
    const bulletin = await this.dataSource
      .getRepository(BocBulletin)
      .createQueryBuilder('b')
      .addSelect('b.document')
      .where('b.tradingDate = :tradingDate', { tradingDate })
      .getOne();
    if (!bulletin) throw new BulletinNotFoundError(tradingDate);
    return bulletin.document;
  }

  /**
   * Applies an admin's corrections to a held day's rows, re-runs the checks
   * so the remaining reasons stay accurate, and keeps the day held.
   */
  async correct(
    tradingDate: string,
    dto: CorrectBulletinDto,
  ): Promise<BulletinDto> {
    return this.dataSource.transaction(async (manager) => {
      const bulletin = await this.findHeld(manager, tradingDate);
      const day = bulletin.parsed;
      for (const fix of dto.securities ?? []) {
        const row = day?.securities.find((s) => s.ticker === fix.ticker);
        if (!row) throw new BulletinUnknownRowError(tradingDate, fix.ticker);
        row.close = fix.close;
        if (fix.open !== undefined) row.open = fix.open;
        if (fix.volume !== undefined) row.volume = fix.volume;
      }
      for (const fix of dto.indices ?? []) {
        const row = day?.indices.find((i) => i.code === fix.code);
        if (!row) throw new BulletinUnknownRowError(tradingDate, fix.code);
        row.value = fix.value;
      }
      if (day) {
        const context = await this.ingestion.checkContext(manager, tradingDate);
        bulletin.failures = runChecks(day, context);
      }
      bulletin.parsed = day;
      await manager.save(bulletin);
      await this.ingestion.storePrices(manager, bulletin);
      return this.toDetail(manager, bulletin);
    });
  }

  /**
   * Publishes a held day as it now stands: its prices are served from now
   * on. The admin's decision overrides any check still failing.
   */
  async publish(tradingDate: string, adminId: string): Promise<BulletinDto> {
    const detail = await this.dataSource.transaction(async (manager) => {
      const bulletin = await this.findHeld(manager, tradingDate);
      bulletin.status = PriceStatus.PUBLISHED;
      bulletin.reviewedById = adminId;
      bulletin.reviewedAt = new Date();
      await manager.save(bulletin);
      await manager.update(
        EodPrice,
        { bulletinId: bulletin.id },
        { status: PriceStatus.PUBLISHED },
      );
      return this.toDetail(manager, bulletin);
    });
    this.ingestion.announcePublished(tradingDate);
    return detail;
  }

  private async find(
    manager: EntityManager,
    tradingDate: string,
  ): Promise<BocBulletin> {
    const bulletin = await manager.findOneBy(BocBulletin, { tradingDate });
    if (!bulletin) throw new BulletinNotFoundError(tradingDate);
    return bulletin;
  }

  private async findHeld(
    manager: EntityManager,
    tradingDate: string,
  ): Promise<BocBulletin> {
    const bulletin = await this.find(manager, tradingDate);
    if (bulletin.status === PriceStatus.PUBLISHED) {
      throw new BulletinNotHeldError(tradingDate);
    }
    return bulletin;
  }

  private async toDetail(
    manager: EntityManager,
    bulletin: BocBulletin,
  ): Promise<BulletinDto> {
    const tickers = new Set(
      (await manager.find(Security, { select: ['ticker'] })).map(
        (s) => s.ticker,
      ),
    );
    const codes = new Set(
      (await manager.find(MarketIndex, { select: ['code'] })).map(
        (i) => i.code,
      ),
    );
    const day = bulletin.parsed;
    return {
      ...toSummary(bulletin),
      securities: (day?.securities ?? []).map((s) => ({
        ticker: s.ticker,
        name: s.name,
        inCatalogue: tickers.has(s.ticker),
        previousClose: s.previousClose,
        open: s.open,
        close: s.close,
        volume: s.volume,
        variation: s.variation,
        traded: s.traded,
      })),
      indices: (day?.indices ?? []).map((i) => ({
        code: i.code,
        name: i.name,
        inCatalogue: codes.has(i.code),
        value: i.value,
        variation: i.variation,
      })),
    };
  }
}

function toSummary(bulletin: BocBulletin): BulletinSummaryDto {
  return {
    tradingDate: bulletin.tradingDate,
    status: bulletin.status,
    reference: bulletin.parsed?.reference ?? null,
    origin: bulletin.origin,
    sourceUrl: bulletin.sourceUrl,
    checksum: bulletin.checksum,
    fetchedAt: bulletin.fetchedAt.toISOString(),
    failures: bulletin.failures,
    reviewedAt: bulletin.reviewedAt?.toISOString() ?? null,
  };
}
