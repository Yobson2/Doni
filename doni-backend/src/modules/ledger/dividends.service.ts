import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  DividendAlreadyConfirmedError,
  DividendNotPaidYetError,
  DividendNotSuggestedError,
} from '@common/exceptions/ledger.exceptions';
import { CorporateActionsService } from '@modules/securities/corporate-actions/corporate-actions.service';
import { ReferenceDividend } from '@modules/securities/dividends/reference-dividend.entity';
import { ReferenceDividendsService } from '@modules/securities/dividends/reference-dividends.service';
import {
  ConfirmDividendDto,
  DividendCalendarItemDto,
} from './dto/dividend.dto';
import { LedgerEntryDto } from './dto/portfolio.dto';
import { type CalendarLine, dividendCalendar } from './dividend-calendar';
import { dividendEntitlements } from './engine';
import { DividendDismissal } from './entities/dividend-dismissal.entity';
import {
  LedgerEntryKind,
  LedgerEntryRecord,
} from './entities/ledger-entry.entity';
import {
  findOwnedPortfolio,
  ledgerOf,
  toEngineEntry,
  toLedgerEntryDto,
  today,
  withLedgerErrors,
} from './ledger-records';

/**
 * A portfolio's dividends. Suggestions are derived on every read from the
 * reference dividends and the ledger (shares held at each ex-date); they
 * are never stored and never counted. Confirming one records the net amount
 * received as a user dividend, a ledger entry; dismissing one only hides it.
 */
@Injectable()
export class DividendsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly referenceDividends: ReferenceDividendsService,
    private readonly corporateActions: CorporateActionsService,
  ) {}

  /**
   * Upcoming and past dividends on the securities the portfolio holds or
   * held at their ex-date, by payment date, with their status.
   */
  async calendar(
    ownerId: string,
    portfolioId: string,
  ): Promise<DividendCalendarItemDto[]> {
    const manager = this.dataSource.manager;
    await findOwnedPortfolio(manager, ownerId, portfolioId);
    const { dividends, lines } = await this.linesOf(manager, portfolioId);
    const byId = new Map(dividends.map((d) => [d.id, d]));
    return lines
      .map((line) => toItemDto(byId.get(line.referenceDividendId)!, line))
      .sort(
        (a, b) =>
          a.paymentDate.localeCompare(b.paymentDate) ||
          a.ticker.localeCompare(b.ticker),
      );
  }

  /**
   * Records the net amount received for a suggested dividend as a user
   * dividend dated on its payment date. Only a dividend the portfolio is
   * entitled to, already paid and not yet recorded, can be confirmed; a
   * dismissed suggestion can still be.
   */
  async confirm(
    ownerId: string,
    portfolioId: string,
    referenceDividendId: string,
    dto: ConfirmDividendDto,
  ): Promise<LedgerEntryDto> {
    return this.dataSource.transaction(async (manager) => {
      await findOwnedPortfolio(manager, ownerId, portfolioId, { lock: true });
      const { dividend, line, ledger } = await this.lineFor(
        manager,
        portfolioId,
        referenceDividendId,
      );
      if (line.status === 'confirmed') {
        throw new DividendAlreadyConfirmedError({
          referenceDividendId: dividend.id,
          entryId: line.entryId!,
        });
      }
      if (line.status === 'upcoming') {
        throw new DividendNotSuggestedError(referenceDividendId);
      }
      if (line.status === 'awaiting_payment') {
        throw new DividendNotPaidYetError(dividend.paymentDate);
      }

      const saved = await manager.save(
        manager.create(LedgerEntryRecord, {
          portfolioId,
          kind: LedgerEntryKind.DIVIDEND,
          securityId: dividend.securityId,
          tradeDate: dividend.paymentDate,
          quantity: line.shares,
          price: dividend.grossPerShare,
          fees: '0',
          amount: dto.amount,
          referenceDividendId: dividend.id,
          sgi: dto.sgi ?? sgiBefore(ledger, dividend),
        }),
      );
      await manager.delete(DividendDismissal, {
        portfolioId,
        referenceDividendId: dividend.id,
      });
      return toLedgerEntryDto({ ...saved, security: dividend.security }, null);
    });
  }

  /** Hides a dividend suggestion (see `DividendDismissal`). */
  async dismiss(
    ownerId: string,
    portfolioId: string,
    referenceDividendId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await findOwnedPortfolio(manager, ownerId, portfolioId, { lock: true });
      const { dividend, line } = await this.lineFor(
        manager,
        portfolioId,
        referenceDividendId,
      );
      if (line.status === 'confirmed') {
        throw new DividendAlreadyConfirmedError({
          referenceDividendId: dividend.id,
          entryId: line.entryId!,
        });
      }
      if (line.status === 'upcoming') {
        throw new DividendNotSuggestedError(referenceDividendId);
      }
      await manager
        .createQueryBuilder()
        .insert()
        .into(DividendDismissal)
        .values({ portfolioId, referenceDividendId: dividend.id })
        .orIgnore()
        .execute();
    });
  }

  /** Undoes a dismissal: the suggestion shows again. */
  async restore(
    ownerId: string,
    portfolioId: string,
    referenceDividendId: string,
  ): Promise<void> {
    const manager = this.dataSource.manager;
    await findOwnedPortfolio(manager, ownerId, portfolioId);
    await manager.delete(DividendDismissal, {
      portfolioId,
      referenceDividendId: referenceDividendId.toLowerCase(),
    });
  }

  /** The calendar line of one reference dividend, or "not suggested". */
  private async lineFor(
    manager: EntityManager,
    portfolioId: string,
    referenceDividendId: string,
  ) {
    const { dividends, lines, ledger } = await this.linesOf(
      manager,
      portfolioId,
    );
    const id = referenceDividendId.toLowerCase();
    const dividend = dividends.find((d) => d.id === id);
    const line = lines.find((l) => l.referenceDividendId === id);
    if (!dividend || !line) {
      throw new DividendNotSuggestedError(referenceDividendId);
    }
    return { dividend, line, ledger };
  }

  private async linesOf(
    manager: EntityManager,
    portfolioId: string,
  ): Promise<{
    dividends: ReferenceDividend[];
    lines: CalendarLine[];
    ledger: LedgerEntryRecord[];
  }> {
    const ledger = await ledgerOf(manager, portfolioId);
    const securityIds = [...new Set(ledger.map((e) => e.securityId))];
    const [dividends, corporateActions, dismissals] = await Promise.all([
      this.referenceDividends.forSecurities(securityIds),
      this.corporateActions.inEffectFor(securityIds),
      manager.find(DividendDismissal, { where: { portfolioId } }),
    ]);
    const entitlements = withLedgerErrors(ledger, () =>
      dividendEntitlements({
        entries: ledger.map(toEngineEntry),
        corporateActions,
        dividends: dividends.map((d) => ({
          id: d.id,
          securityId: d.securityId,
          exDate: d.exDate,
          grossPerShare: d.grossPerShare,
        })),
      }),
    );
    const lines = dividendCalendar({
      today: today(),
      dividends,
      entitlements,
      confirmed: ledger
        .filter((e) => e.kind === LedgerEntryKind.DIVIDEND)
        .map((e) => ({
          referenceDividendId: e.referenceDividendId!,
          entryId: e.id,
          shares: e.quantity,
          amount: e.amount!,
        })),
      dismissed: new Set(dismissals.map((d) => d.referenceDividendId)),
    });
    return { dividends, lines, ledger };
  }
}

/**
 * The SGI of the latest buy or opening position of the dividend's security
 * before its ex-date: where the shares that earned it were held.
 */
function sgiBefore(
  ledger: LedgerEntryRecord[],
  dividend: ReferenceDividend,
): string {
  const holdings = ledger.filter(
    (e) =>
      e.securityId === dividend.securityId &&
      e.tradeDate < dividend.exDate &&
      (e.kind === LedgerEntryKind.BUY ||
        e.kind === LedgerEntryKind.OPENING_POSITION),
  );
  return holdings.at(-1)?.sgi ?? '';
}

function toItemDto(
  dividend: ReferenceDividend,
  line: CalendarLine,
): DividendCalendarItemDto {
  return {
    referenceDividendId: dividend.id,
    ticker: dividend.security?.ticker ?? '',
    securityName: dividend.security?.name ?? '',
    exDate: dividend.exDate,
    paymentDate: dividend.paymentDate,
    grossPerShare: dividend.grossPerShare,
    sourceNoticeUrl: dividend.sourceNoticeUrl,
    shares: line.shares,
    grossAmount: line.grossAmount,
    status: line.status,
    netAmount: line.netAmount,
    entryId: line.entryId,
  };
}
