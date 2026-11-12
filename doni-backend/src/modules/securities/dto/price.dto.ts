import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PriceStatus } from '../entities/eod-price.entity';

/** A calendar date as YYYY-MM-DD. */
export const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** A non-negative decimal written with digits and an optional point. */
const DECIMAL = /^\d{1,15}(\.\d{1,6})?$/;
const DECIMAL_MESSAGE = '$property must be a decimal string such as "4190"';
const DATE_MESSAGE = '$property must be a date as YYYY-MM-DD';

/**
 * One trading day's end-of-day price as the API returns it to users: always
 * a published price, always with its source and date. Decimals are strings.
 */
export class EndOfDayPriceDto {
  @ApiProperty({
    format: 'date',
    example: '2026-11-11',
    description: 'Trading day the price applies to',
  })
  date: string;

  @ApiProperty({ example: '4190', description: 'Closing price, XOF' })
  close: string;

  @ApiProperty({ type: String, nullable: true, example: '4000' })
  open: string | null;

  @ApiProperty({ type: String, nullable: true })
  high: string | null;

  @ApiProperty({ type: String, nullable: true })
  low: string | null;

  @ApiProperty({ type: String, nullable: true, example: '85624' })
  volume: string | null;

  @ApiProperty({
    example: 'https://www.brvm.org/sites/default/files/boc_20261111_2.pdf',
    description: 'The BOC the price was read from',
  })
  sourceDocument: string;

  @ApiProperty({
    format: 'date',
    example: '2026-11-11',
    description: 'Date the BOC was published',
  })
  publishedOn: string;
}

/**
 * One day of a security's price history, restated in today's shares: a
 * price dated before a split, reverse split or free-share allotment is
 * divided by its quantity factor, so the series compares directly with
 * adjusted positions. Volumes are as published.
 */
export class AdjustedEndOfDayPriceDto extends EndOfDayPriceDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '20500',
    description:
      'The close as published in the BOC when a later corporate action restated it; null when close is the published close',
  })
  publishedClose: string | null;
}

/** A stored price as an admin sees it, with its review status. */
export class StoredPriceDto extends EndOfDayPriceDto {
  @ApiProperty({ enum: PriceStatus, enumName: 'PriceStatus' })
  status: PriceStatus;
}

/** A price hand-entered from a BOC (admin). */
export class PutPriceDto {
  @ApiProperty({ example: '4190' })
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  close: string;

  @ApiPropertyOptional({ example: '4000' })
  @IsOptional()
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  open?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  high?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  low?: string;

  @ApiPropertyOptional({ example: '85624' })
  @IsOptional()
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  volume?: string;

  @ApiProperty({
    example: 'https://www.brvm.org/sites/default/files/boc_20261111_2.pdf',
    description: 'The BOC the price was read from (URL or reference)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  sourceDocument: string;

  @ApiProperty({ format: 'date', example: '2026-11-11' })
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  publishedOn: string;

  @ApiPropertyOptional({
    enum: PriceStatus,
    enumName: 'PriceStatus',
    description:
      'Defaults to published; pending_review holds the price back from users',
  })
  @IsOptional()
  @IsEnum(PriceStatus)
  status?: PriceStatus;
}

/** Path of one trading day's price of a security. */
export class SecurityPriceDayParamsDto {
  @ApiProperty({ example: 'SNTS' })
  @IsString()
  ticker: string;

  @ApiProperty({ format: 'date', example: '2026-11-11' })
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  date: string;
}

/** Path of one trading day's value of an index. */
export class IndexPriceDayParamsDto {
  @ApiProperty({ example: 'BRVM-C' })
  @IsString()
  code: string;

  @ApiProperty({ format: 'date', example: '2026-11-11' })
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  date: string;
}

/** Optional inclusive date range for a price history. */
export class PriceHistoryQueryDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  to?: string;
}
