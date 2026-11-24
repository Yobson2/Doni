import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUrl, Matches, MaxLength } from 'class-validator';
import { ISO_DATE } from '../dto/price.dto';

/** A decimal greater than zero written with digits and an optional point. */
const POSITIVE_DECIMAL = /^(?!0+(\.0+)?$)\d{1,15}(\.\d{1,6})?$/;
const DATE_MESSAGE = '$property must be a date as YYYY-MM-DD';

/** A reference dividend as users see it, always with its source notice. */
export class ReferenceDividendDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ example: '1655', description: 'Gross amount per share, XOF' })
  grossPerShare: string;

  @ApiProperty({
    format: 'date',
    example: '2026-05-12',
    description:
      'First trading day without the dividend: shares held at the close of the day before earn it',
  })
  exDate: string;

  @ApiProperty({ format: 'date', example: '2026-05-20' })
  paymentDate: string;

  @ApiProperty({
    example: 'https://www.brvm.org/fr/avis/example',
    description: 'The notice the dividend was read from',
  })
  sourceNoticeUrl: string;
}

/** A reference dividend entered from its notice (admin). */
export class CreateReferenceDividendDto {
  @ApiProperty({ example: '1655', description: 'Gross amount per share, XOF' })
  @Matches(POSITIVE_DECIMAL, {
    message: '$property must be a decimal string greater than zero',
  })
  grossPerShare: string;

  @ApiProperty({ format: 'date', example: '2026-05-12' })
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: '$property must be a real date' })
  exDate: string;

  @ApiProperty({
    format: 'date',
    example: '2026-05-20',
    description: 'On or after the ex-date',
  })
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: '$property must be a real date' })
  paymentDate: string;

  @ApiProperty({ example: 'https://www.brvm.org/fr/avis/example' })
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(2048)
  sourceNoticeUrl: string;
}
