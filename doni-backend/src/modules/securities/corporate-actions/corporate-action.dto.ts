import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ISO_DATE } from '../dto/price.dto';
import { CorporateActionKind } from './corporate-action.entity';

/** A non-negative decimal written with digits and an optional point. */
const DECIMAL = /^\d{1,15}(\.\d{1,6})?$/;
const DECIMAL_MESSAGE = '$property must be a decimal string such as "4190"';
const DATE_MESSAGE = '$property must be a date as YYYY-MM-DD';

const RATIO_DESCRIPTION =
  'The ratio reads "ratioReceived shares for every ratioHeld". Split and ' +
  'reverse split: the ratioHeld shares are replaced by ratioReceived new ' +
  'ones (1:5 split = held 1, received 5). Free shares: ratioReceived are ' +
  'added for every ratioHeld. Rights issue: ratioReceived new shares may ' +
  'be subscribed for every ratioHeld.';

/** A corporate action as users see it, always with its source notice. */
export class CorporateActionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ enum: CorporateActionKind, enumName: 'CorporateActionKind' })
  kind: CorporateActionKind;

  @ApiProperty({
    format: 'date',
    example: '2026-04-02',
    description: 'First trading day on the new basis',
  })
  effectiveDate: string;

  @ApiProperty({ example: 1, description: RATIO_DESCRIPTION })
  ratioHeld: number;

  @ApiProperty({ example: 5 })
  ratioReceived: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Cash paid per new share for a fraction of a share, as the notice states',
  })
  cashInLieuPrice: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Subscription price per new share (rights issue only)',
  })
  subscriptionPrice: string | null;

  @ApiProperty({
    example: 'https://www.brvm.org/fr/avis/example',
    description: 'The BRVM notice the corporate action was read from',
  })
  sourceNoticeUrl: string;
}

/** A corporate action entered from its BRVM notice (admin). */
export class CreateCorporateActionDto {
  @ApiProperty({ enum: CorporateActionKind, enumName: 'CorporateActionKind' })
  @IsEnum(CorporateActionKind)
  kind: CorporateActionKind;

  @ApiProperty({ format: 'date', example: '2026-04-02' })
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  effectiveDate: string;

  @ApiProperty({ example: 1, description: RATIO_DESCRIPTION })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  ratioHeld: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  ratioReceived: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '41000',
    description:
      'Cash paid per new share for a fraction of a share, only if the notice states it',
  })
  @IsOptional()
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  cashInLieuPrice?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '3000',
    description:
      'Subscription price per new share; required for a rights issue',
  })
  @IsOptional()
  @Matches(DECIMAL, { message: DECIMAL_MESSAGE })
  subscriptionPrice?: string | null;

  @ApiProperty({ example: 'https://www.brvm.org/fr/avis/example' })
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(2048)
  sourceNoticeUrl: string;
}
