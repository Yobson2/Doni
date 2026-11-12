/**
 * The ledger engine: a pure, framework-free module. Its whole interface is
 * `replay` (ledger entries and end-of-day prices in; positions, PMP,
 * realised and unrealised gains out), its input and result types, and the
 * rule violations it throws. Nothing here does I/O or knows about NestJS.
 */
export { replay } from './replay';
export {
  InsufficientQuantityError,
  InvalidLedgerEntryError,
  LedgerRuleViolation,
} from './errors';
export type {
  LedgerEntry,
  PortfolioTotals,
  Position,
  PositionValuation,
  ReplayInput,
  ReplayResult,
  TradeEntry,
  ValuationPrice,
} from './types';
