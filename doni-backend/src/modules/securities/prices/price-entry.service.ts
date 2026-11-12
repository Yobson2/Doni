import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PutPriceDto, StoredPriceDto } from '../dto/price.dto';
import { EodPrice, PriceStatus } from '../entities/eod-price.entity';
import { PriceSubject } from './price-source';
import { toEndOfDayPrice } from './database-price-source';

/**
 * Stores end-of-day prices hand-entered by an admin from a BOC. Entering the
 * same day again replaces it, so a typo is corrected by re-entering the day.
 * This is the write side; consumers read through the PriceSource.
 */
@Injectable()
export class PriceEntryService {
  constructor(
    @InjectRepository(EodPrice)
    private readonly prices: Repository<EodPrice>,
  ) {}

  async put(
    subject: PriceSubject,
    tradingDate: string,
    dto: PutPriceDto,
  ): Promise<StoredPriceDto> {
    const where = { ...subject, tradingDate };
    const row =
      (await this.prices.findOneBy(where)) ??
      this.prices.create({ securityId: null, indexId: null, ...where });

    Object.assign(row, {
      close: dto.close,
      open: dto.open ?? null,
      high: dto.high ?? null,
      low: dto.low ?? null,
      volume: dto.volume ?? null,
      sourceDocument: dto.sourceDocument,
      publishedOn: dto.publishedOn,
      status: dto.status ?? PriceStatus.PUBLISHED,
    });
    const saved = await this.prices.save(row);
    return { ...toEndOfDayPrice(saved), status: saved.status };
  }
}
