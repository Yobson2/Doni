import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import {
  CorporateActionAlreadyExistsError,
  CorporateActionNotFoundError,
  InvalidCorporateActionTermsError,
} from '@common/exceptions/catalogue.exceptions';
import {
  type CorporateAction as EngineCorporateAction,
  adjustPrice,
} from '@modules/ledger/engine';
import { Security } from '../entities/security.entity';
import type { EndOfDayPrice } from '../prices/price-source';
import {
  CorporateActionDto,
  CreateCorporateActionDto,
} from './corporate-action.dto';
import {
  CorporateAction,
  CorporateActionKind,
} from './corporate-action.entity';

/** An end-of-day price restated in today's shares. */
export interface AdjustedEndOfDayPrice extends EndOfDayPrice {
  /** The close as published in the BOC, when it was restated; else null. */
  publishedClose: string | null;
}

/**
 * Corporate actions: entered by an admin from their BRVM notice, read by
 * every user, applied by the ledger engine to positions and used to restate
 * earlier prices in today's shares.
 */
@Injectable()
export class CorporateActionsService {
  constructor(
    @InjectRepository(CorporateAction)
    private readonly actions: Repository<CorporateAction>,
  ) {}

  async list(security: Security): Promise<CorporateActionDto[]> {
    const actions = await this.actions.find({
      where: { securityId: security.id },
      order: { effectiveDate: 'ASC', createdAt: 'ASC' },
    });
    return actions.map((action) => toDto(action, security));
  }

  async create(
    security: Security,
    dto: CreateCorporateActionDto,
  ): Promise<CorporateActionDto> {
    checkTerms(dto);
    await this.checkUnique(security, dto);
    const action = await this.actions.save(
      this.actions.create({ ...fieldsOf(dto), securityId: security.id }),
    );
    return toDto(action, security);
  }

  async replace(
    security: Security,
    id: string,
    dto: CreateCorporateActionDto,
  ): Promise<CorporateActionDto> {
    const action = await this.findOne(security, id);
    checkTerms(dto);
    await this.checkUnique(security, dto, id);
    Object.assign(action, fieldsOf(dto));
    return toDto(await this.actions.save(action), security);
  }

  async remove(security: Security, id: string): Promise<void> {
    await this.actions.remove(await this.findOne(security, id));
  }

  /**
   * The corporate actions on these securities that have taken effect (on
   * or before today), in the ledger engine's terms. Announced actions with a
   * later effective date are left out until that day.
   */
  async inEffectFor(securityIds: string[]): Promise<EngineCorporateAction[]> {
    if (securityIds.length === 0) return [];
    const actions = await this.actions.find({
      where: {
        securityId: In(securityIds),
        effectiveDate: LessThanOrEqual(today()),
      },
    });
    return actions.map(toEngineAction);
  }

  /**
   * A price history restated in today's shares: every price dated before a
   * split, reverse split or free-share allotment in effect is divided by its
   * quantity factor, so the series has no artificial jump and compares
   * directly with adjusted positions and PMPs. Volumes stay as published.
   */
  async adjustHistory(
    securityId: string,
    prices: EndOfDayPrice[],
  ): Promise<AdjustedEndOfDayPrice[]> {
    const actions = await this.inEffectFor([securityId]);
    const adjust = (value: string | null, date: string) =>
      value === null ? null : adjustPrice(value, date, actions);
    return prices.map((price) => {
      const close = adjustPrice(price.close, price.date, actions);
      return {
        ...price,
        close,
        open: adjust(price.open, price.date),
        high: adjust(price.high, price.date),
        low: adjust(price.low, price.date),
        publishedClose: close === price.close ? null : price.close,
      };
    });
  }

  private async findOne(
    security: Security,
    id: string,
  ): Promise<CorporateAction> {
    const action = await this.actions.findOneBy({
      id,
      securityId: security.id,
    });
    if (!action) throw new CorporateActionNotFoundError(id);
    return action;
  }

  private async checkUnique(
    security: Security,
    dto: CreateCorporateActionDto,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.actions.findOneBy({
      securityId: security.id,
      kind: dto.kind,
      effectiveDate: dto.effectiveDate,
    });
    if (existing && existing.id !== exceptId) {
      throw new CorporateActionAlreadyExistsError(
        security.ticker,
        dto.kind,
        dto.effectiveDate,
      );
    }
  }
}

/** Terms that the field validators cannot check on their own. */
function checkTerms(dto: CreateCorporateActionDto): void {
  const { kind, ratioHeld, ratioReceived } = dto;
  if (kind === CorporateActionKind.SPLIT && ratioReceived <= ratioHeld) {
    throw new InvalidCorporateActionTermsError(
      'a split gives more shares than are held (ratioReceived > ratioHeld)',
    );
  }
  if (
    kind === CorporateActionKind.REVERSE_SPLIT &&
    ratioReceived >= ratioHeld
  ) {
    throw new InvalidCorporateActionTermsError(
      'a reverse split gives fewer shares than are held (ratioReceived < ratioHeld)',
    );
  }
  const rights = kind === CorporateActionKind.RIGHTS_ISSUE;
  if (rights && dto.subscriptionPrice == null) {
    throw new InvalidCorporateActionTermsError(
      'a rights issue needs its subscription price',
    );
  }
  if (!rights && dto.subscriptionPrice != null) {
    throw new InvalidCorporateActionTermsError(
      'only a rights issue has a subscription price',
    );
  }
  if (rights && dto.cashInLieuPrice != null) {
    throw new InvalidCorporateActionTermsError(
      'a rights issue does not change shares held, so it has no cash in lieu',
    );
  }
}

function fieldsOf(dto: CreateCorporateActionDto) {
  return {
    kind: dto.kind,
    effectiveDate: dto.effectiveDate,
    ratioHeld: dto.ratioHeld,
    ratioReceived: dto.ratioReceived,
    cashInLieuPrice: dto.cashInLieuPrice ?? null,
    subscriptionPrice: dto.subscriptionPrice ?? null,
    sourceNoticeUrl: dto.sourceNoticeUrl,
  };
}

function toDto(
  action: CorporateAction,
  security: Security,
): CorporateActionDto {
  return {
    id: action.id,
    ticker: security.ticker,
    kind: action.kind,
    effectiveDate: action.effectiveDate,
    ratioHeld: action.ratioHeld,
    ratioReceived: action.ratioReceived,
    cashInLieuPrice: action.cashInLieuPrice,
    subscriptionPrice: action.subscriptionPrice,
    sourceNoticeUrl: action.sourceNoticeUrl,
  };
}

function toEngineAction(action: CorporateAction): EngineCorporateAction {
  return {
    id: action.id,
    kind: action.kind,
    securityId: action.securityId,
    effectiveDate: action.effectiveDate,
    held: String(action.ratioHeld),
    received: String(action.ratioReceived),
    cashInLieuPrice: action.cashInLieuPrice,
  };
}

/** Today's date (UTC) as YYYY-MM-DD. */
const today = () => new Date().toISOString().slice(0, 10);
