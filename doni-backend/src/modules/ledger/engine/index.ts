/**
 * The ledger engine: a pure, framework-free module. Its whole interface is
 * `replay` (ledger entries and end-of-day prices in; positions, PMP,
 * realised and unrealised gains out), `performanceStart` (the day
 * performance is measured from), `allocate` (how a market value is spread,
 * as percentages that add up to 100), their input and result types, and the
 * rule violations it throws. Nothing here does I/O or knows about NestJS.
 */
export { allocate } from './allocation';
export { performanceStart } from './performance-start';
export { replay } from './replay';
export { adjustPrice } from './corporate-actions';
export {
  InvalidCorporateActionError,
  InsufficientQuantityError,
  InvalidLedgerEntryError,
  LedgerRuleViolation,
} from './errors';
export type {
  Allocation,
  AllocationLine,
  AllocationShare,
  CorporateAction,
  CorporateActionKind,
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
