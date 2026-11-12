import { HttpStatus } from '@nestjs/common';
import { LedgerErrorCode } from '../constants/error-codes';
import { BaseAppException } from './base.exception';

/**
 * No portfolio with that id belongs to the current user. Someone else's
 * portfolio gets the same answer as one that does not exist.
 */
export class PortfolioNotFoundError extends BaseAppException {
  constructor(id: string) {
    super(
      `Portfolio not found: ${id}`,
      HttpStatus.NOT_FOUND,
      LedgerErrorCode.PORTFOLIO_NOT_FOUND,
      { id },
    );
  }
}

/** The ledger entry would sell more shares than were held at some date. */
export class InsufficientQuantityException extends BaseAppException {
  constructor(context: {
    ticker: string;
    date: string;
    held: string;
    sold: string;
  }) {
    super(
      `Cannot sell ${context.sold} ${context.ticker} on ${context.date}: only ${context.held} held`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      LedgerErrorCode.INSUFFICIENT_QUANTITY,
      context,
    );
  }
}

/** The ledger entry's values cannot be replayed. */
export class InvalidLedgerEntryException extends BaseAppException {
  constructor(field: string, value: string) {
    super(
      `Invalid ${field}: ${value}`,
      HttpStatus.BAD_REQUEST,
      LedgerErrorCode.INVALID_ENTRY,
      { field, value },
    );
  }
}

/** The ledger entry names a security that is not in the catalogue. */
export class UnknownLedgerSecurityError extends BaseAppException {
  constructor(ticker: string) {
    super(
      `Unknown security: ${ticker}`,
      HttpStatus.BAD_REQUEST,
      LedgerErrorCode.UNKNOWN_SECURITY,
      { ticker },
    );
  }
}

/** A trade cannot be dated after today. */
export class FutureTradeDateError extends BaseAppException {
  constructor(date: string) {
    super(
      `Trade date ${date} is in the future`,
      HttpStatus.BAD_REQUEST,
      LedgerErrorCode.FUTURE_TRADE_DATE,
      { date },
    );
  }
}
