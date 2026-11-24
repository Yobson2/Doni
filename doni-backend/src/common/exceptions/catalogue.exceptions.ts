import { HttpStatus } from '@nestjs/common';
import { CatalogueErrorCode } from '../constants/error-codes';
import { BaseAppException } from './base.exception';

type CatalogueItem = 'security' | 'sector' | 'index';

const NOT_FOUND: Record<CatalogueItem, CatalogueErrorCode> = {
  security: CatalogueErrorCode.SECURITY_NOT_FOUND,
  sector: CatalogueErrorCode.SECTOR_NOT_FOUND,
  index: CatalogueErrorCode.INDEX_NOT_FOUND,
};

const ALREADY_EXISTS: Record<CatalogueItem, CatalogueErrorCode> = {
  security: CatalogueErrorCode.SECURITY_ALREADY_EXISTS,
  sector: CatalogueErrorCode.SECTOR_ALREADY_EXISTS,
  index: CatalogueErrorCode.INDEX_ALREADY_EXISTS,
};

/** No security, sector or index with that code. */
export class CatalogueItemNotFoundError extends BaseAppException {
  constructor(item: CatalogueItem, code: string) {
    super(`Unknown ${item}: ${code}`, HttpStatus.NOT_FOUND, NOT_FOUND[item], {
      code,
    });
  }
}

/** A security, sector or index with that code is already in the catalogue. */
export class CatalogueItemAlreadyExistsError extends BaseAppException {
  constructor(item: CatalogueItem, code: string) {
    super(
      `A ${item} with code ${code} already exists`,
      HttpStatus.CONFLICT,
      ALREADY_EXISTS[item],
      { code },
    );
  }
}

/** No corporate action with that id on that security. */
export class CorporateActionNotFoundError extends BaseAppException {
  constructor(id: string) {
    super(
      `Corporate action not found: ${id}`,
      HttpStatus.NOT_FOUND,
      CatalogueErrorCode.CORPORATE_ACTION_NOT_FOUND,
      { id },
    );
  }
}

/** The security already has a corporate action of that kind on that date. */
export class CorporateActionAlreadyExistsError extends BaseAppException {
  constructor(ticker: string, kind: string, effectiveDate: string) {
    super(
      `${ticker} already has a ${kind} effective ${effectiveDate}`,
      HttpStatus.CONFLICT,
      CatalogueErrorCode.CORPORATE_ACTION_ALREADY_EXISTS,
      { ticker, kind, effectiveDate },
    );
  }
}

/** The terms do not fit the kind of corporate action. */
export class InvalidCorporateActionTermsError extends BaseAppException {
  constructor(reason: string) {
    super(
      `Invalid corporate action terms: ${reason}`,
      HttpStatus.BAD_REQUEST,
      CatalogueErrorCode.CORPORATE_ACTION_INVALID_TERMS,
      { reason },
    );
  }
}

/** No reference dividend with that id on that security. */
export class ReferenceDividendNotFoundError extends BaseAppException {
  constructor(id: string) {
    super(
      `Reference dividend not found: ${id}`,
      HttpStatus.NOT_FOUND,
      CatalogueErrorCode.DIVIDEND_NOT_FOUND,
      { id },
    );
  }
}

/** The security already has a reference dividend with that ex-date. */
export class ReferenceDividendAlreadyExistsError extends BaseAppException {
  constructor(ticker: string, exDate: string) {
    super(
      `${ticker} already has a dividend with ex-date ${exDate}`,
      HttpStatus.CONFLICT,
      CatalogueErrorCode.DIVIDEND_ALREADY_EXISTS,
      { ticker, exDate },
    );
  }
}

/** The dividend's dates do not fit together. */
export class InvalidReferenceDividendTermsError extends BaseAppException {
  constructor(reason: string) {
    super(
      `Invalid dividend terms: ${reason}`,
      HttpStatus.BAD_REQUEST,
      CatalogueErrorCode.DIVIDEND_INVALID_TERMS,
      { reason },
    );
  }
}

/** A request refers to a sector that is not in the catalogue. */
export class UnknownSectorError extends BaseAppException {
  constructor(code: string) {
    super(
      `Unknown sector: ${code}`,
      HttpStatus.BAD_REQUEST,
      CatalogueErrorCode.SECTOR_NOT_FOUND,
      { code },
    );
  }
}

/** No BOC has been stored for that trading day. */
export class BulletinNotFoundError extends BaseAppException {
  constructor(tradingDate: string) {
    super(
      `No BOC stored for ${tradingDate}`,
      HttpStatus.NOT_FOUND,
      CatalogueErrorCode.BULLETIN_NOT_FOUND,
      { tradingDate },
    );
  }
}

/**
 * The trading day is already published: only a held (pending_review) day is
 * corrected or published from its bulletin.
 */
export class BulletinNotHeldError extends BaseAppException {
  constructor(tradingDate: string) {
    super(
      `The BOC of ${tradingDate} is already published`,
      HttpStatus.CONFLICT,
      CatalogueErrorCode.BULLETIN_NOT_HELD,
      { tradingDate },
    );
  }
}

/** A correction names a security or index the bulletin does not list. */
export class BulletinUnknownRowError extends BaseAppException {
  constructor(tradingDate: string, code: string) {
    super(
      `The BOC of ${tradingDate} has no row for ${code}`,
      HttpStatus.BAD_REQUEST,
      CatalogueErrorCode.BULLETIN_UNKNOWN_ROW,
      { tradingDate, code },
    );
  }
}
