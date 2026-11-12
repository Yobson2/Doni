import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ISO_DATE } from '@modules/securities/dto/price.dto';
import { LedgerEntryKind } from '../entities/ledger-entry.entity';

/*
 * Every decimal crosses the API as a string (ADR 0005) and every amount is
 * in XOF (ADR 0008). Derived values (PMP, gains, market values) are exact:
 * the client rounds them for display only.
 */

/** A whole number of shares, greater than zero. */
const SHARES = /^[1-9]\d{0,14}$/;
/** A non-negative decimal written with digits and an optional point. */
const DECIMAL = /^\d{1,15}(\.\d{1,6})?$/;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// ─── Portfolios ──────────────────────────────────────────────

export class PortfolioDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Mon portefeuille' })
  name: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class CreatePortfolioDto {
  @ApiProperty({ example: 'Mon portefeuille', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

// ─── Ledger entries ──────────────────────────────────────────

const TRADE_KINDS = [LedgerEntryKind.BUY, LedgerEntryKind.SELL] as const;

export class CreateLedgerEntryDto {
  @ApiProperty({ enum: TRADE_KINDS, enumName: 'TradeKind' })
  @IsIn(TRADE_KINDS)
  kind: (typeof TRADE_KINDS)[number];

  @ApiProperty({ example: 'SNTS' })
  @IsString()
  @IsNotEmpty()
  ticker: string;

  @ApiProperty({
    format: 'date',
    example: '2026-03-16',
    description: 'Trade date; not after today',
  })
  @Matches(ISO_DATE, { message: '$property must be a date as YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: '$property must be a real date' })
  date: string;

  @ApiProperty({ example: '100', description: 'Whole number of shares' })
  @Matches(SHARES, {
    message: '$property must be a whole number of shares such as "100"',
  })
  quantity: string;

  @ApiProperty({ example: '4000', description: 'Price per share, XOF' })
  @Matches(DECIMAL, { message: '$property must be a decimal string' })
  price: string;

  @ApiPropertyOptional({
    example: '2000',
    description: 'Total fees for the trade, XOF; defaults to 0',
  })
  @IsOptional()
  @Matches(DECIMAL, { message: '$property must be a decimal string' })
  fees?: string;

  @ApiProperty({
    example: 'SGI Example',
    description: 'The SGI the trade went through',
    maxLength: 100,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sgi: string;
}

/**
 * An opening position: the quantity held and its PMP as of a date, entered
 * instead of the trades that led there (ADR 0001). It states the holding at
 * the start of that day and replaces what earlier entries say about the
 * security; performance is only measured from its date.
 */
export class CreateOpeningPositionDto {
  @ApiProperty({ example: 'SNTS' })
  @IsString()
  @IsNotEmpty()
  ticker: string;

  @ApiProperty({
    format: 'date',
    example: '2026-01-02',
    description:
      'Day the holding is stated for (at the start of that day); not after today',
  })
  @Matches(ISO_DATE, { message: '$property must be a date as YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: '$property must be a real date' })
  date: string;

  @ApiProperty({ example: '200', description: 'Whole number of shares held' })
  @Matches(SHARES, {
    message: '$property must be a whole number of shares such as "100"',
  })
  quantity: string;

  @ApiProperty({
    example: '3850.25',
    description: 'PMP of the shares held, fees included, XOF',
  })
  @Matches(DECIMAL, { message: '$property must be a decimal string' })
  pmp: string;

  @ApiProperty({
    example: 'SGI Example',
    description: 'The SGI the shares are held with',
    maxLength: 100,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sgi: string;
}

export class LedgerEntryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LedgerEntryKind, enumName: 'LedgerEntryKind' })
  kind: LedgerEntryKind;

  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ example: 'Sonatel' })
  securityName: string;

  @ApiProperty({ format: 'date', example: '2026-03-16' })
  date: string;

  @ApiProperty({ example: '100' })
  quantity: string;

  @ApiProperty({
    example: '4000',
    description:
      'Price per share excluding fees; for an opening position, its PMP',
  })
  price: string;

  @ApiProperty({ example: '2000', description: '0 for an opening position' })
  fees: string;

  @ApiProperty({ example: 'SGI Example' })
  sgi: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When the entry was recorded',
  })
  recordedAt: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The entry this one corrects, when it was recorded by editing an earlier entry; null otherwise',
  })
  replacesId: string | null;
}

// ─── Valuation ───────────────────────────────────────────────

export class PositionValuationDto {
  @ApiProperty({ example: '4190', description: 'End-of-day price used' })
  price: string;

  @ApiProperty({
    format: 'date',
    example: '2026-11-11',
    description: 'Trading day the price applies to (as of)',
  })
  priceDate: string;

  @ApiProperty({ example: '377100', description: 'quantity × price' })
  marketValue: string;

  @ApiProperty({ example: '6255', description: 'marketValue − costBasis' })
  unrealisedGain: string;
}

export class PositionDto {
  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ example: 'Sonatel' })
  name: string;

  @ApiProperty({ example: '90', description: '0 once fully sold' })
  quantity: string;

  @ApiProperty({ example: '4120.5', description: 'PMP, fees included' })
  pmp: string;

  @ApiProperty({ example: '370845', description: 'quantity × PMP' })
  costBasis: string;

  @ApiProperty({ example: '21420' })
  realisedGain: string;

  @ApiProperty({
    type: PositionValuationDto,
    nullable: true,
    description: 'Null when the position is closed or has no price',
  })
  valuation: PositionValuationDto | null;
}

export class PortfolioTotalsDto {
  @ApiProperty({ example: '370845' })
  costBasis: string;

  @ApiProperty({ example: '21420' })
  realisedGain: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '377100',
    description: 'Null when an open position has no end-of-day price',
  })
  marketValue: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '6255',
    description: 'Null when an open position has no end-of-day price',
  })
  unrealisedGain: string | null;
}

const PERCENT_DESCRIPTION =
  'Share of the allocated market value, in percent with one decimal place. Rounded by largest remainder, so the lines add up to exactly 100.0.';

export class SecurityAllocationDto {
  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ example: 'Sonatel' })
  name: string;

  @ApiProperty({ example: '377100' })
  marketValue: string;

  @ApiProperty({ example: '65.3', description: PERCENT_DESCRIPTION })
  percent: string;
}

export class SectorAllocationDto {
  @ApiProperty({ example: 'TEL' })
  code: string;

  @ApiProperty({ example: 'Télécommunications' })
  nameFr: string;

  @ApiProperty({ example: 'Telecommunications' })
  nameEn: string;

  @ApiProperty({ example: '577100' })
  marketValue: string;

  @ApiProperty({ example: '100.0', description: PERCENT_DESCRIPTION })
  percent: string;
}

export class UnpricedPositionDto {
  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ example: 'Sonatel' })
  name: string;
}

/**
 * How the market value of the open positions is spread. Only positions with
 * an end-of-day price can be allocated; the others are listed in `unpriced`,
 * never counted as worth 0.
 */
export class PortfolioAllocationDto {
  @ApiProperty({
    example: '577100',
    description:
      'Market value of the allocated (priced) open positions: the whole the percentages are shares of',
  })
  marketValue: string;

  @ApiProperty({
    type: [SecurityAllocationDto],
    description: 'Largest market value first',
  })
  bySecurity: SecurityAllocationDto[];

  @ApiProperty({
    type: [SectorAllocationDto],
    description: 'Largest market value first',
  })
  bySector: SectorAllocationDto[];

  @ApiProperty({
    type: [UnpricedPositionDto],
    description:
      'Open positions left out of the allocation because they have no end-of-day price yet',
  })
  unpriced: UnpricedPositionDto[];
}

export class PortfolioValuationDto {
  @ApiProperty({ type: PortfolioDto })
  portfolio: PortfolioDto;

  @ApiProperty({
    type: [PositionDto],
    description: 'Open positions first, then closed ones; by ticker',
  })
  positions: PositionDto[];

  @ApiProperty({ type: PortfolioTotalsDto })
  totals: PortfolioTotalsDto;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-01-02',
    description:
      'Performance is measured from this day only: the latest opening position, or the first entry when the full trade history was entered. Null for an empty ledger.',
  })
  performanceSince: string | null;

  @ApiProperty({ type: PortfolioAllocationDto })
  allocation: PortfolioAllocationDto;
}
