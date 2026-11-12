import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CatalogueItemAlreadyExistsError,
  CatalogueItemNotFoundError,
  UnknownSectorError,
} from '@common/exceptions/catalogue.exceptions';
import {
  CreateMarketIndexDto,
  CreateSectorDto,
  CreateSecurityDto,
  MarketIndexDto,
  SectorDto,
  SecurityDto,
  UpdateSecurityDto,
  UpdateSectorDto,
} from './dto/catalogue.dto';
import { MarketIndex } from './entities/market-index.entity';
import { Sector } from './entities/sector.entity';
import { ProfileLanguage, Security } from './entities/security.entity';
import {
  EndOfDayPrice,
  PRICE_SOURCE,
  type PriceSource,
} from './prices/price-source';

/** The securities catalogue: sectors, securities and indices. */
@Injectable()
export class CatalogueService {
  constructor(
    @InjectRepository(Sector) private readonly sectors: Repository<Sector>,
    @InjectRepository(Security)
    private readonly securities: Repository<Security>,
    @InjectRepository(MarketIndex)
    private readonly indices: Repository<MarketIndex>,
    @Inject(PRICE_SOURCE) private readonly priceSource: PriceSource,
  ) {}

  // ─── Sectors ───────────────────────────────────────────────

  async listSectors(): Promise<SectorDto[]> {
    const sectors = await this.sectors.find({ order: { code: 'ASC' } });
    return sectors.map(toSectorDto);
  }

  async createSector(dto: CreateSectorDto): Promise<SectorDto> {
    if (await this.sectors.existsBy({ code: dto.code })) {
      throw new CatalogueItemAlreadyExistsError('sector', dto.code);
    }
    return toSectorDto(await this.sectors.save(this.sectors.create(dto)));
  }

  async updateSector(code: string, dto: UpdateSectorDto): Promise<SectorDto> {
    const sector = await this.sectors.findOneBy({ code });
    if (!sector) throw new CatalogueItemNotFoundError('sector', code);
    Object.assign(sector, dto);
    return toSectorDto(await this.sectors.save(sector));
  }

  // ─── Securities ────────────────────────────────────────────

  async listSecurities(): Promise<SecurityDto[]> {
    const securities = await this.securities.find({
      relations: { sector: true },
      order: { ticker: 'ASC' },
    });
    const latest = await this.priceSource.getLatestForSecurities(
      securities.map((s) => s.id),
    );
    return securities.map((s) => toSecurityDto(s, latest.get(s.id) ?? null));
  }

  async getSecurity(ticker: string): Promise<SecurityDto> {
    const security = await this.findSecurity(ticker);
    const latest = await this.priceSource.getLatest({
      securityId: security.id,
    });
    return toSecurityDto(security, latest);
  }

  /** The security with that ticker, or a 404. */
  async findSecurity(ticker: string): Promise<Security> {
    const security = await this.securities.findOne({
      where: { ticker },
      relations: { sector: true },
    });
    if (!security) throw new CatalogueItemNotFoundError('security', ticker);
    return security;
  }

  async createSecurity(dto: CreateSecurityDto): Promise<SecurityDto> {
    if (await this.securities.existsBy({ ticker: dto.ticker })) {
      throw new CatalogueItemAlreadyExistsError('security', dto.ticker);
    }
    const { sectorCode, ...fields } = dto;
    const security = this.securities.create({
      ...fields,
      isin: fields.isin ?? null,
      profileFr: fields.profileFr ?? null,
      profileEn: fields.profileEn ?? null,
      profileOriginalLanguage:
        fields.profileOriginalLanguage ?? ProfileLanguage.FR,
      sector: await this.findSectorFor(sectorCode),
    });
    await this.securities.save(security);
    return this.getSecurity(dto.ticker);
  }

  async updateSecurity(
    ticker: string,
    dto: UpdateSecurityDto,
  ): Promise<SecurityDto> {
    const security = await this.findSecurity(ticker);
    const { sectorCode, ...fields } = dto;
    Object.assign(security, fields);
    if (sectorCode !== undefined) {
      security.sector = await this.findSectorFor(sectorCode);
      security.sectorId = security.sector.id;
    }
    await this.securities.save(security);
    return this.getSecurity(ticker);
  }

  private async findSectorFor(code: string): Promise<Sector> {
    const sector = await this.sectors.findOneBy({ code });
    if (!sector) throw new UnknownSectorError(code);
    return sector;
  }

  // ─── Indices ───────────────────────────────────────────────

  async listIndices(): Promise<MarketIndexDto[]> {
    const indices = await this.indices.find({ order: { code: 'ASC' } });
    return Promise.all(
      indices.map(async (index) => ({
        code: index.code,
        name: index.name,
        latestPrice: await this.priceSource.getLatest({ indexId: index.id }),
      })),
    );
  }

  /** The index with that code, or a 404. */
  async findIndex(code: string): Promise<MarketIndex> {
    const index = await this.indices.findOneBy({ code });
    if (!index) throw new CatalogueItemNotFoundError('index', code);
    return index;
  }

  async createIndex(dto: CreateMarketIndexDto): Promise<MarketIndexDto> {
    if (await this.indices.existsBy({ code: dto.code })) {
      throw new CatalogueItemAlreadyExistsError('index', dto.code);
    }
    const index = await this.indices.save(this.indices.create(dto));
    return { code: index.code, name: index.name, latestPrice: null };
  }
}

function toSectorDto(sector: Sector): SectorDto {
  return { code: sector.code, nameFr: sector.nameFr, nameEn: sector.nameEn };
}

function toSecurityDto(
  security: Security,
  latestPrice: EndOfDayPrice | null,
): SecurityDto {
  return {
    ticker: security.ticker,
    name: security.name,
    isin: security.isin,
    sector: toSectorDto(security.sector),
    country: security.country,
    profileFr: security.profileFr,
    profileEn: security.profileEn,
    profileOriginalLanguage: security.profileOriginalLanguage,
    latestPrice,
  };
}
