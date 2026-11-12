/**
 * Why a ledger cannot be replayed. The engine throws these; callers turn them
 * into a refusal of the ledger entry that caused them. Framework-free on
 * purpose: the engine knows nothing about HTTP.
 */
export abstract class LedgerRuleViolation extends Error {
  /** The ledger entry that breaks the rule. */
  abstract readonly entryId: string;
}

/**
 * A ledger entry whose values the engine cannot use: a quantity that is not
 * positive, a negative price or fee, or a value that is not a plain decimal
 * string.
 */
export class InvalidLedgerEntryError extends LedgerRuleViolation {
  override readonly name = 'InvalidLedgerEntryError';

  constructor(
    readonly entryId: string,
    readonly field: string,
    readonly value: string,
  ) {
    super(`Ledger entry ${entryId} has an invalid ${field}: ${value}`);
  }
}

/**
 * A sell would make a position negative: at that date, fewer shares were
 * held than sold (ADR 0004).
 */
export class InsufficientQuantityError extends LedgerRuleViolation {
  override readonly name = 'InsufficientQuantityError';

  constructor(
    readonly entryId: string,
    readonly securityId: string,
    readonly date: string,
    /** Shares held at that date, before the sale. */
    readonly held: string,
    readonly sold: string,
  ) {
    super(
      `Cannot sell ${sold} shares of ${securityId} on ${date}: ${held} held`,
    );
  }
}
