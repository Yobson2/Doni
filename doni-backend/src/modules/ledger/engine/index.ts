/**
 * The ledger engine: a pure, framework-free module. Its whole interface is
 * `replay` (ledger entries and end-of-day prices in; positions, PMP,
 * realised and unrealised gains out), `performanceStart` (the day
 * performance is measured from), their input and result types, and the
 * rule violations it throws. Nothing here does I/O or knows about NestJS.
 */
export { performanceStart } from './performance-start';
export { replay } from './replay';
export {
  InsufficientQuantityError,
  InvalidLedgerEntryError,
  LedgerRuleViolation,
} from './errors';
export type {
  LedgerEntry,
  OpeningPositionEntry,
  PortfolioTotals,
  Position,
  PositionValuation,
  ReplayInput,
  ReplayResult,
  TradeEntry,
  ValuationPrice,
} from './types';
