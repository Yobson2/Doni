import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ISO_DATE } from '../dto/price.dto';
import { PriceStatus } from '../entities/price-status';
import { BulletinOrigin } from './boc-bulletin.entity';
import { BocCheck } from './boc-checks';
import { IngestionOutcome } from './boc-ingestion.service';

const DECIMAL = /^\d{1,15}(\.\d{1,6})?$/;
const DECIMAL_MESSAGE = '$property must be a decimal string such as "4190"';
const DATE_MESSAGE = '$property must be a date as YYYY-MM-DD';

export class CheckFailureDto {
  @ApiProperty({ enum: BocCheck, enumName: 'BocCheck' })
  check: BocCheck;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'SNTS',
    description: 'The security ticker or index code concerned',
  })
  subject: string | null;

  @ApiProperty({
    example: 'SNTS is in the catalogue but not listed in the bulletin.',
  })
  reason: string;
}

/** A stored BOC, without its rows (admin). */
export class BulletinSummaryDto {
  @ApiProperty({ format: 'date', example: '2026-11-11' })
  tradingDate: string;

  @ApiProperty({ enum: PriceStatus, enumName: 'PriceStatus' })
  status: PriceStatus;

  @ApiProperty({ type: String, nullable: true, example: '215' })
  reference: string | null;

  @ApiProperty({
    enum: BulletinOrigin,
    enumName: 'BulletinOrigin',
    description:
      'daily: the daily ingestion; backfill: the historical backfill, whose prices users see only once HISTORY_PUBLIC is on',
  })
  origin: BulletinOrigin;

  @ApiProperty({
    example: 'https://www.brvm.org/sites/default/files/boc_20261111_2.pdf',
  })
  sourceUrl: string;

  @ApiProperty({ description: 'SHA-256 of the original PDF, hex' })
  checksum: string;

  @ApiProperty({ format: 'date-time' })
  fetchedAt: string;

  @ApiProperty({ type: [CheckFailureDto] })
  failures: CheckFailureDto[];

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  reviewedAt: string | null;
}

/** One share row as read from the BOC (admin). */
export class BulletinSecurityRowDto {
  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ example: 'SONATEL SN' })
  name: string;

  @ApiProperty({ description: 'Whether the security is in the catalogue' })
  inCatalogue: boolean;

  @ApiProperty({ type: String, nullable: true, example: '4000' })
  previousClose: string | null;

  @ApiProperty({ type: String, nullable: true, example: '4000' })
  open: string | null;

  @ApiProperty({ example: '4190' })
  close: string;

  @ApiProperty({ type: String, nullable: true, example: '85624' })
  volume: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '4.75',
    description: 'Daily variation as printed, in percent',
  })
  variation: string | null;

  @ApiProperty({ description: 'False when suspended or not quoted that day' })
  traded: boolean;
}

/** One index value as read from the BOC (admin). */
export class BulletinIndexRowDto {
  @ApiProperty({ example: 'BRVM-C' })
  code: string;

  @ApiProperty({ example: 'BRVM COMPOSITE' })
  name: string;

  @ApiProperty({ description: 'Whether the index is in the catalogue' })
  inCatalogue: boolean;

  @ApiProperty({ example: '517.17' })
  value: string;

  @ApiProperty({ type: String, nullable: true, example: '0.85' })
  variation: string | null;
}

/** A stored BOC with what was read from it (admin). */
export class BulletinDto extends BulletinSummaryDto {
  @ApiProperty({ type: [BulletinSecurityRowDto] })
  securities: BulletinSecurityRowDto[];

  @ApiProperty({ type: [BulletinIndexRowDto] })
  indices: BulletinIndexRowDto[];
}

export class IngestionResultDto {
  @ApiProperty({ format: 'date', example: '2026-11-11' })
  tradingDate: string;

  @ApiProperty({ enum: IngestionOutcome, enumName: 'IngestionOutcome' })
  outcome: IngestionOutcome;

  @ApiProperty({ type: [CheckFailureDto] })
  failures: CheckFailureDto[];
}

export class ListBulletinsQueryDto {
  @ApiPropertyOptional({ enum: PriceStatus, enumName: 'PriceStatus' })
  @IsOptional()
  @IsEnum(PriceStatus)
  status?: PriceStatus;
}

export class BulletinDateParamsDto {
  @ApiProperty({ format: 'date', example: '2026-11-11' })
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  date: string;
}

export class SecurityCorrectionDto {
  @ApiProperty({ example: 'SNTS' })
  @IsString()
  ticker: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '4000' })
  @IsOptional()
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  open?: string | null;

  @ApiProperty({ example: '4190' })
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  close: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '85624' })
  @IsOptional()
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  volume?: string | null;
}

export class IndexCorrectionDto {
  @ApiProperty({ example: 'BRVM-C' })
  @IsString()
  code: string;

  @ApiProperty({ example: '517.17' })
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  value: string;
}

/** Corrected values for a held day's rows (admin). */
export class CorrectBulletinDto {
  @ApiPropertyOptional({ type: [SecurityCorrectionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SecurityCorrectionDto)
  securities?: SecurityCorrectionDto[];

  @ApiPropertyOptional({ type: [IndexCorrectionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => IndexCorrectionDto)
  indices?: IndexCorrectionDto[];
}
