import { DataSource, EntityManager, FindOptionsWhere } from 'typeorm';
import { EodPrice, PriceStatus } from '../entities/eod-price.entity';
import { MarketIndex } from '../entities/market-index.entity';
import { Sector } from '../entities/sector.entity';
import { ProfileLanguage, Security } from '../entities/security.entity';
import {
  SEED_INDICES,
  SEED_SECTORS,
  SEED_SECURITIES,
  seedSourceDocument,
} from './boc-seed-data';

/**
 * Adds the seed securities, sectors, indices and their BOC prices. Only adds
 * what is missing: it never overwrites a row an admin has edited, so it is
 * safe to run again.
 */
export async function seedCatalogue(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    for (const sector of SEED_SECTORS) {
      await insertIfMissing(manager, Sector, sector, ['code']);
    }

    for (const { prices, sectorCode, ...fields } of SEED_SECURITIES) {
      const sector = await manager.findOneByOrFail(Sector, {
        code: sectorCode,
      });
      await insertIfMissing(
        manager,
        Security,
        {
          ...fields,
          isin: null,
          sectorId: sector.id,
          profileOriginalLanguage: ProfileLanguage.FR,
        },
        ['ticker'],
      );
      const security = await manager.findOneByOrFail(Security, {
        ticker: fields.ticker,
      });
      for (const price of prices) {
        await insertIfMissing(
          manager,
          EodPrice,
          {
            securityId: security.id,
            indexId: null,
            tradingDate: price.date,
            open: price.open,
            close: price.close,
            high: null,
            low: null,
            volume: price.volume,
            sourceDocument: seedSourceDocument(price.date),
            publishedOn: price.date,
            status: PriceStatus.PUBLISHED,
          },
          ['securityId', 'tradingDate'],
        );
      }
    }

    for (const { values, ...fields } of SEED_INDICES) {
      await insertIfMissing(manager, MarketIndex, fields, ['code']);
      const index = await manager.findOneByOrFail(MarketIndex, {
        code: fields.code,
      });
      for (const value of values) {
        await insertIfMissing(
          manager,
          EodPrice,
          {
            securityId: null,
            indexId: index.id,
            tradingDate: value.date,
            open: null,
            close: value.close,
            high: null,
            low: null,
            volume: null,
            sourceDocument: seedSourceDocument(value.date),
            publishedOn: value.date,
            status: PriceStatus.PUBLISHED,
          },
          ['indexId', 'tradingDate'],
        );
      }
    }
  });
}

async function insertIfMissing<T extends object>(
  manager: EntityManager,
  entity: new () => T,
  values: Partial<T>,
  uniqueBy: (keyof T & string)[],
): Promise<void> {
  const where = Object.fromEntries(
    uniqueBy.map((key) => [key, values[key]]),
  ) as FindOptionsWhere<T>;
  if (await manager.existsBy(entity, where)) return;
  await manager.insert(entity, values as never);
}
