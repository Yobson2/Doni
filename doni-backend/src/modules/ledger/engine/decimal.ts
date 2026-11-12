import Big from 'big.js';

/**
 * The engine's decimal type (ADR 0005). big.js adds, subtracts and multiplies
 * exactly, with no precision limit; only division rounds, to `DP` decimal
 * places with banker's rounding. A private constructor keeps this
 * configuration from leaking into, or being changed by, other code.
 */
export const Decimal = Big();
Decimal.DP = 30;
Decimal.RM = Big.roundHalfEven;
Decimal.strict = true;

export type Decimal = Big.Big;

export const ZERO = new Decimal('0');

/** A decimal as a plain string, never in exponential notation. */
export const toDecimalString = (value: Decimal): string => value.toFixed();
