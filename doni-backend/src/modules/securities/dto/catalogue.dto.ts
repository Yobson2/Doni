import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ProfileLanguage } from '../entities/security.entity';
import { EndOfDayPriceDto } from './price.dto';

const CODE = /^[A-Z0-9][A-Z0-9.-]{0,19}$/;
const CODE_MESSAGE = '$property must be upper-case letters, digits, . or -';

// ─── Sectors ─────────────────────────────────────────────────

export class SectorDto {
  @ApiProperty({ example: 'TEL' })
  code: string;

  @ApiProperty({ example: 'Télécommunications' })
  nameFr: string;

  @ApiProperty({ example: 'Telecommunications' })
  nameEn: string;
}

export class CreateSectorDto {
  @ApiProperty({ example: 'TEL' })
  @Matches(CODE, { message: CODE_MESSAGE })
  code: string;

  @ApiProperty({ example: 'Télécommunications' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameFr: string;

  @ApiProperty({ example: 'Telecommunications' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameEn: string;
}

export class UpdateSectorDto extends PartialType(
  OmitType(CreateSectorDto, ['code'] as const),
) {}

// ─── Securities ──────────────────────────────────────────────

export class SecurityDto {
  @ApiProperty({ example: 'SNTS' })
  ticker: string;

  @ApiProperty({ example: 'SONATEL SN' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  isin: string | null;

  @ApiProperty({ type: SectorDto })
  sector: SectorDto;

  @ApiProperty({ example: 'SN', description: 'ISO 3166-1 alpha-2' })
  country: string;

  @ApiProperty({ type: String, nullable: true })
  profileFr: string | null;

  @ApiProperty({ type: String, nullable: true })
  profileEn: string | null;

  @ApiProperty({
    enum: ProfileLanguage,
    enumName: 'ProfileLanguage',
    description:
      'Language the profile was written in; the other one is a translation',
  })
  profileOriginalLanguage: ProfileLanguage;

  @ApiProperty({
    type: EndOfDayPriceDto,
    nullable: true,
    description: 'Most recent published end-of-day price',
  })
  latestPrice: EndOfDayPriceDto | null;
}

export class CreateSecurityDto {
  @ApiProperty({ example: 'SNTS' })
  @Matches(CODE, { message: CODE_MESSAGE })
  ticker: string;

  @ApiProperty({ example: 'SONATEL SN' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[A-Z]{2}[A-Z0-9]{9}\d$/, { message: '$property must be an ISIN' })
  isin?: string | null;

  @ApiProperty({ example: 'TEL' })
  @IsString()
  sectorCode: string;

  @ApiProperty({ example: 'SN' })
  @Matches(/^[A-Z]{2}$/, { message: '$property must be an ISO country code' })
  country: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(5000)
  profileFr?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(5000)
  profileEn?: string | null;

  @ApiPropertyOptional({
    enum: ProfileLanguage,
    enumName: 'ProfileLanguage',
    description: 'Defaults to fr',
  })
  @IsOptional()
  @IsEnum(ProfileLanguage)
  profileOriginalLanguage?: ProfileLanguage;
}

export class UpdateSecurityDto extends PartialType(
  OmitType(CreateSecurityDto, ['ticker'] as const),
) {}

// ─── Indices ─────────────────────────────────────────────────

export class MarketIndexDto {
  @ApiProperty({ example: 'BRVM-C' })
  code: string;

  @ApiProperty({ example: 'BRVM Composite' })
  name: string;

  @ApiProperty({ type: EndOfDayPriceDto, nullable: true })
  latestPrice: EndOfDayPriceDto | null;
}

export class CreateMarketIndexDto {
  @ApiProperty({ example: 'BRVM-C' })
  @Matches(CODE, { message: CODE_MESSAGE })
  code: string;

  @ApiProperty({ example: 'BRVM Composite' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}
