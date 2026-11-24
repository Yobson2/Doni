import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/*
 * A portfolio's returns over a period (ADR 0007). Returns cross the API as
 * percentages with two decimal places ("10.00" is 10 %); every figure
 * names its method and the period it covers.
 */

/** The periods a return can be asked for. */
export const RETURNS_PERIODS = ['1M', '3M', 'YTD', '1Y', 'ALL'] as const;
export type ReturnsPeriod = (typeof RETURNS_PERIODS)[number];

export class ReturnsQueryDto {
  @ApiPropertyOptional({
    enum: RETURNS_PERIODS,
    enumName: 'ReturnsPeriod',
    default: 'ALL',
    description:
      'One month, three months, year to date, one year, or since the performance start (ALL). A period is never measured from before the performance start.',
  })
  @IsOptional()
  @IsIn(RETURNS_PERIODS)
  period?: ReturnsPeriod;
}

const XIRR_STATUSES = ['solved', 'no_solution', 'unpriced'] as const;

/** "Mon rendement": the money-weighted return of the user's own money. */
export class XirrDto {
  @ApiProperty({ enum: ['xirr'], description: 'Money-weighted (XIRR)' })
  method: 'xirr';

  @ApiProperty({
    example: true,
    description: 'Always true: the XIRR is a rate per year',
  })
  annualised: boolean;

  @ApiProperty({
    enum: XIRR_STATUSES,
    enumName: 'XirrStatus',
    description:
      'solved; no_solution when the cash flows have none (e.g. a single day); unpriced when a security held at the start or end of the period has no end-of-day price on or before that day',
  })
  status: (typeof XIRR_STATUSES)[number];

  @ApiProperty({
    type: String,
    nullable: true,
    example: '12.34',
    description: 'Annual rate as a percentage; null unless solved',
  })
  percent: string | null;
}

/** One trading day of the benchmark comparison. */
export class ReturnsPointDto {
  @ApiProperty({ format: 'date', example: '2026-11-11' })
  date: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '4.20',
    description:
      'Portfolio TWR since the start of the period, as a percentage; null on a data gap (never interpolated)',
  })
  portfolio: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '3.10',
    description:
      'Benchmark change since the start of the period, as a percentage; null on a data gap (never interpolated)',
  })
  benchmark: string | null;
}

export class BenchmarkDto {
  @ApiProperty({ example: 'BRVM-C' })
  code: string;

  @ApiProperty({ example: 'BRVM Composite' })
  name: string;
}

/** Portfolio TWR next to the benchmark over the same days. */
export class ComparisonDto {
  @ApiProperty({ enum: ['twr'], description: 'Time-weighted (TWR)' })
  method: 'twr';

  @ApiProperty({ type: BenchmarkDto })
  benchmark: BenchmarkDto;

  @ApiProperty({ type: [ReturnsPointDto], description: 'Oldest first' })
  points: ReturnsPointDto[];
}

/** A trading day of the period with data missing. */
export class DataGapDto {
  @ApiProperty({ format: 'date', example: '2026-11-10' })
  date: string;

  @ApiProperty({ description: 'The benchmark has no value that day' })
  benchmark: boolean;

  @ApiProperty({
    type: [String],
    example: ['SNTS'],
    description: 'Securities held that day with no end-of-day price',
  })
  tickers: string[];
}

export class PortfolioReturnsDto {
  @ApiProperty({ enum: RETURNS_PERIODS, enumName: 'ReturnsPeriod' })
  period: ReturnsPeriod;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description:
      'First day measured: the later of the period start and the performance start. Null when there is nothing to measure.',
  })
  from: string | null;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description:
      'Last day measured: the last trading day on or before today. Null when there is nothing to measure.',
  })
  to: string | null;

  @ApiProperty({ type: XirrDto })
  xirr: XirrDto;

  @ApiProperty({ type: ComparisonDto })
  comparison: ComparisonDto;

  @ApiProperty({
    type: [DataGapDto],
    description: 'Days of the period with data missing, oldest first',
  })
  gaps: DataGapDto[];
}
