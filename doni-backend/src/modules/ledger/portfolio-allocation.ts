import type { Sector } from '@modules/securities/entities/sector.entity';
import type { Security } from '@modules/securities/entities/security.entity';
import type { PortfolioAllocationDto } from './dto/portfolio.dto';
import { type Position, allocate } from './engine';

/**
 * The allocation of a portfolio's open positions by security and by sector
 * (`allocate` does the arithmetic). A position without an end-of-day price
 * has no market value: it is left out and listed as unpriced, never counted
 * as worth 0. Closed positions hold nothing and are left out.
 *
 * `securities` maps each security id to its security, sector loaded.
 */
export function allocationOf(
  positions: readonly Position[],
  securities: ReadonlyMap<string, Security>,
): PortfolioAllocationDto {
  const withSecurity = positions.map((position) => ({
    position,
    security: securities.get(position.securityId) as Security,
  }));
  const held = withSecurity.filter(({ position }) => position.quantity !== '0');
  const priced = held.flatMap(({ position, security }) =>
    position.valuation
      ? [{ security, marketValue: position.valuation.marketValue }]
      : [],
  );

  const names = new Map(
    priced.map(({ security }) => [security.ticker, security]),
  );
  const sectors = new Map<string, Sector>(
    priced.map(({ security }) => [security.sector.code, security.sector]),
  );
  const bySecurity = allocate(
    priced.map(({ security, marketValue }) => ({
      key: security.ticker,
      marketValue,
    })),
  );
  const bySector = allocate(
    priced.map(({ security, marketValue }) => ({
      key: security.sector.code,
      marketValue,
    })),
  );

  return {
    marketValue: bySecurity.marketValue,
    bySecurity: bySecurity.lines.map(({ key, marketValue, percent }) => ({
      ticker: key,
      name: (names.get(key) as Security).name,
      marketValue,
      percent,
    })),
    bySector: bySector.lines.map(({ key, marketValue, percent }) => {
      const { code, nameFr, nameEn } = sectors.get(key) as Sector;
      return { code, nameFr, nameEn, marketValue, percent };
    }),
    unpriced: held
      .filter(({ position }) => !position.valuation)
      .map(({ security: { ticker, name } }) => ({ ticker, name }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker)),
  };
}
