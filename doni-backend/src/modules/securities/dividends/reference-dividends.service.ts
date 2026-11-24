import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  InvalidReferenceDividendTermsError,
  ReferenceDividendAlreadyExistsError,
  ReferenceDividendNotFoundError,
} from '@common/exceptions/catalogue.exceptions';
import { Security } from '../entities/security.entity';
import {
  CreateReferenceDividendDto,
  ReferenceDividendDto,
} from './reference-dividend.dto';
import { ReferenceDividend } from './reference-dividend.entity';

/**
 * Reference dividends: entered and corrected by an admin from their notice,
 * read by every user, and the basis of each holder's dividend suggestions.
 */
@Injectable()
export class ReferenceDividendsService {
  constructor(
    @InjectRepository(ReferenceDividend)
    private readonly dividends: Repository<ReferenceDividend>,
  ) {}

  async list(security: Security): Promise<ReferenceDividendDto[]> {
    const dividends = await this.dividends.find({
      where: { securityId: security.id },
      order: { exDate: 'ASC' },
    });
    return dividends.map((dividend) => toDto(dividend, security));
  }

  async create(
    security: Security,
    dto: CreateReferenceDividendDto,
  ): Promise<ReferenceDividendDto> {
    checkTerms(dto);
    await this.checkUnique(security, dto);
    const dividend = await this.dividends.save(
      this.dividends.create({ ...fieldsOf(dto), securityId: security.id }),
    );
    return toDto(dividend, security);
  }

  /**
   * Corrects a reference dividend. Suggestions follow the new terms; user
   * dividends already confirmed keep the amounts the user confirmed.
   */
  async replace(
    security: Security,
    id: string,
    dto: CreateReferenceDividendDto,
  ): Promise<ReferenceDividendDto> {
    const dividend = await this.dividends.findOneBy({
      id,
      securityId: security.id,
    });
    if (!dividend) throw new ReferenceDividendNotFoundError(id);
    checkTerms(dto);
    await this.checkUnique(security, dto, id);
    Object.assign(dividend, fieldsOf(dto));
    return toDto(await this.dividends.save(dividend), security);
  }

  /** Every reference dividend on these securities, with its security. */
  async forSecurities(securityIds: string[]): Promise<ReferenceDividend[]> {
    if (securityIds.length === 0) return [];
    return this.dividends.find({
      where: { securityId: In(securityIds) },
      relations: { security: true },
      order: { exDate: 'ASC', createdAt: 'ASC' },
    });
  }

  private async checkUnique(
    security: Security,
    dto: CreateReferenceDividendDto,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.dividends.findOneBy({
      securityId: security.id,
      exDate: dto.exDate,
    });
    if (existing && existing.id !== exceptId) {
      throw new ReferenceDividendAlreadyExistsError(
        security.ticker,
        dto.exDate,
      );
    }
  }
}

function checkTerms(dto: CreateReferenceDividendDto): void {
  if (dto.paymentDate < dto.exDate) {
    throw new InvalidReferenceDividendTermsError(
      'the payment date cannot be before the ex-date',
    );
  }
}

const fieldsOf = (dto: CreateReferenceDividendDto) => ({
  grossPerShare: dto.grossPerShare,
  exDate: dto.exDate,
  paymentDate: dto.paymentDate,
  sourceNoticeUrl: dto.sourceNoticeUrl,
});

export function toDto(
  dividend: ReferenceDividend,
  security: Security,
): ReferenceDividendDto {
  return {
    id: dividend.id,
    ticker: security.ticker,
    grossPerShare: dividend.grossPerShare,
    exDate: dividend.exDate,
    paymentDate: dividend.paymentDate,
    sourceNoticeUrl: dividend.sourceNoticeUrl,
  };
}
