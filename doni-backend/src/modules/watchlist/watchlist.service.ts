import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogueItemNotFoundError } from '@common/exceptions/catalogue.exceptions';
import { Security } from '@modules/securities/entities/security.entity';
import {
  type EndOfDayPrice,
  PRICE_SOURCE,
  type PriceSource,
} from '@modules/securities/prices/price-source';
import { WatchlistItemDto } from './dto/watchlist.dto';
import { WatchlistItem } from './entities/watchlist-item.entity';

/**
 * Each user's watchlist. Every method takes the current user's id and only
 * ever reads or changes that user's items. Prices come from the PriceSource,
 * so they are always published ones.
 */
@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(WatchlistItem)
    private readonly items: Repository<WatchlistItem>,
    @InjectRepository(Security)
    private readonly securities: Repository<Security>,
    @Inject(PRICE_SOURCE) private readonly priceSource: PriceSource,
  ) {}

  /** The user's watched securities, by ticker. */
  async list(userId: string): Promise<WatchlistItemDto[]> {
    const items = await this.items.find({
      where: { userId },
      relations: { security: true },
    });
    const latest = await this.priceSource.getLatestForSecurities(
      items.map((item) => item.securityId),
    );
    return items
      .map((item) => toDto(item, latest.get(item.securityId) ?? null))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  /** Adds the security; adding one already watched changes nothing. */
  async add(userId: string, ticker: string): Promise<WatchlistItemDto> {
    const security = await this.findSecurity(ticker);
    await this.items
      .createQueryBuilder()
      .insert()
      .values({ userId, securityId: security.id })
      .orIgnore()
      .execute();
    const item = await this.items.findOneByOrFail({
      userId,
      securityId: security.id,
    });
    const price = await this.priceSource.getLatest({
      securityId: security.id,
    });
    return toDto({ ...item, security }, price);
  }

  /** Removes the security; removing one not watched changes nothing. */
  async remove(userId: string, ticker: string): Promise<void> {
    const security = await this.findSecurity(ticker);
    await this.items.delete({ userId, securityId: security.id });
  }

  private async findSecurity(ticker: string): Promise<Security> {
    const security = await this.securities.findOneBy({ ticker });
    if (!security) throw new CatalogueItemNotFoundError('security', ticker);
    return security;
  }
}

function toDto(
  item: WatchlistItem,
  latestPrice: EndOfDayPrice | null,
): WatchlistItemDto {
  const security = item.security as Security;
  return {
    ticker: security.ticker,
    name: security.name,
    addedAt: item.createdAt.toISOString(),
    latestPrice,
  };
}
