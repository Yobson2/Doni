# Dividends: suggestions derived on read, only confirmed net amounts in the ledger

## Context

Users want to track dividend income without typing every payment. An admin enters each reference dividend once (gross amount per share, ex-date, payment date, source notice), and Doni can work out what each holder is owed. But the amount a holder actually receives differs from shares × gross: withholding tax varies by issuer country and holder, and SGIs deduct charges. The ledger is the single source of truth (ADR 0004) and is replayed with corporate actions (ADR 0015), so the shares held at an ex-date can change whenever the user corrects an old trade or an admin corrects a corporate action.

## Decision

- **A dividend suggestion is derived on every read, never stored.** For each reference dividend on a security in a portfolio's ledger, the ledger engine replays that security's entries dated **before the ex-date** with the corporate actions **effective on or before the ex-date**: the shares held at the close of the day before the ex-date, which is BRVM practice (a share bought on the ex-date trades without the dividend; one sold on it still earns it). The suggestion is those shares × the gross amount per share. A portfolio with no shares then gets no suggestion. Before the ex-date, the calendar shows the shares held now as an estimate.
- **Only a confirmed dividend counts.** The user confirms the net amount received; that appends a `dividend` ledger entry (a user dividend) dated on the payment date, with the reference dividend it came from, the shares held at the ex-date as its quantity and the gross per share as its price, for the record. A user dividend changes neither quantity nor PMP. Suggestions are never counted in valuation, totals or returns.
- **A dividend can be confirmed once it is paid** (payment date on or before today), and once per portfolio and reference dividend while its entry stands. It is corrected like any ledger entry: deleting the entry (a correction, ADR 0004) brings the suggestion back, and the user confirms again.
- **Dismissing a suggestion is stored** (`dividend_dismissals`, one row per portfolio and reference dividend) since it is the user's choice and cannot be derived. It only hides the suggestion and can be undone; it is user data, exported with its portfolio and deleted with it (ADR 0016).
- **Total gain** = realised gain + unrealised gain + user dividends. The portfolio totals show it next to the existing gains. It is not a return: XIRR and TWR (ADR 0007) are separate work.
- **Correcting a reference dividend** changes the suggestions at once; user dividends already confirmed keep the amounts the user confirmed.

## Rejected alternatives

- **Storing suggestions with a status (pending / confirmed / dismissed)**: every backdated trade, correction or corporate-action correction would have to recompute the stored shares, and a stale suggestion would disagree with the ledger it comes from.
- **Recording the suggested gross amount automatically**: overstates income by the withholding the user never received.
- **Counting shares held on the ex-date itself**: a buy on the ex-date would wrongly earn the dividend.

## Consequences

- The calendar replays one security's ledger per reference dividend; ledgers are small, so this is cheap, and it stays consistent with every correction.
- A confirmed dividend stays in the ledger even if a later correction leaves no shares at its ex-date; the calendar still lists it as confirmed, and the user deletes it if it was wrong.
- Reference dividends cannot be deleted once any user dividend refers to them (the foreign key restricts it); they can be corrected.
