import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DIVIDEND_STATUSES, type DividendStatus } from '../dividend-calendar';

/** A decimal greater than zero written with digits and an optional point. */
const POSITIVE_DECIMAL = /^(?!0+(\.0+)?$)\d{1,15}(\.\d{1,6})?$/;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * A reference dividend on a security the portfolio holds, with what the
 * portfolio is entitled to and where the user stands with it. Only a
 * `confirmed` item counts anywhere (as a user dividend in the ledger).
 */
export class DividendCalendarItemDto {
  @ApiProperty({ format: 'uuid' })
  referenceDividendId: string;

  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ example: 'Sonatel' })
  securityName: string;

  @ApiProperty({ format: 'date', example: '2026-05-12' })
  exDate: string;

  @ApiProperty({ format: 'date', example: '2026-05-20' })
  paymentDate: string;

  @ApiProperty({ example: '1655', description: 'Gross amount per share, XOF' })
  grossPerShare: string;

  @ApiProperty({ example: 'https://www.brvm.org/fr/avis/example' })
  sourceNoticeUrl: string;

  @ApiProperty({
    example: '100',
    description:
      'Shares held at the close of the day before the ex-date; for an upcoming dividend, the shares held now. For a confirmed dividend, as recorded.',
  })
  shares: string;

  @ApiProperty({
    example: '165500',
    description:
      'shares × grossPerShare: the suggestion, before withholding. Never counted until confirmed.',
  })
  grossAmount: string;

  @ApiProperty({
    enum: DIVIDEND_STATUSES,
    enumName: 'DividendStatus',
    description:
      'upcoming: ex-date not reached, shares not final. awaiting_payment: entitled, not paid yet. suggested: paid, waiting for the user to confirm the net amount received. confirmed: recorded in the ledger. dismissed: the user dismissed the suggestion.',
  })
  status: DividendStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '140675',
    description: 'The net amount the user confirmed; null unless confirmed',
  })
  netAmount: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The ledger entry recording it; null unless confirmed',
  })
  entryId: string | null;
}

/** The net amount actually received for a suggested dividend. */
export class ConfirmDividendDto {
  @ApiProperty({
    example: '140675',
    description:
      'Net amount received, XOF, after withholding tax and charges, as the SGI statement shows',
  })
  @Matches(POSITIVE_DECIMAL, {
    message: '$property must be a decimal string greater than zero',
  })
  amount: string;

  @ApiPropertyOptional({
    example: 'SGI Example',
    maxLength: 100,
    description:
      'The SGI the dividend was paid into; defaults to the SGI of the latest buy or opening position of the security before the ex-date',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sgi?: string;
}
