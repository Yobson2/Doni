# Doni

Doni is an investment research and portfolio-tracking app for people who already hold securities listed on the BRVM. It shows end-of-day market data and lets each user see what their holdings are worth and how they have performed. It provides information only, never investment advice.

## Language

### Market data

**BRVM** (Bourse Régionale des Valeurs Mobilières):
The regional stock exchange of the West African Economic and Monetary Union (UEMOA), whose listed securities Doni covers.

**BOC** (Bulletin Officiel de la Cote):
The official bulletin the BRVM publishes after each trading session, listing closing prices, volumes and index values. It is Doni's primary source of market data.
_Avoid_: daily report, price sheet

**Security**:
A financial instrument listed on the BRVM that a user can hold or watch (in the MVP, a listed share).
_Avoid_: stock, ticker, asset, instrument

**End-of-day price**:
The official closing price of a security for one trading day, as published in a BOC, always shown with the date it applies to ("as of <date>").
_Avoid_: live price, real-time price, current price, quote

**PriceSource**:
The single entry point through which end-of-day prices are obtained, so that where prices come from (hand-seeded BOC data, parsed BOC PDFs, a future licensed feed) can change without affecting anything that consumes them.
_Avoid_: price provider, price API, feed

**pending_review**:
The status of a trading day whose ingested data failed an automatic check. The day is held for an admin to inspect and its prices are never shown to users, who keep seeing the last validated date.
_Avoid_: draft, unverified, error day

**Corporate action**:
An issuer decision that changes the quantity or terms of a security held (split, reverse split, free-share allotment, rights issue), recorded with its effective date and its source BRVM notice.
_Avoid_: event, adjustment (on its own)

**Reference dividend**:
The dividend an issuer declares for a security (gross amount per share, ex-date, payment date, source notice). Entered once by an admin and shared by all users.
_Avoid_: dividend (unqualified), announced dividend

### Portfolio

**Ledger entry**:
One dated, immutable record in a portfolio's ledger: a buy, a sell, an opening position, a user dividend, or a correction of an earlier entry. The ledger is the single source of truth from which positions are derived.
_Avoid_: transaction, operation, movement, trade (when meaning any ledger entry)

**Opening position**:
A ledger entry stating that the user held a given quantity of a security at a given PMP on a given date, used instead of entering the full trade history. It states the holding at the start of that day: buys and sells on the same date apply on top of it, and it replaces what earlier entries say about that security's quantity and PMP. Performance is only measured from that date.
_Avoid_: initial balance, starting holding, import

**Position**:
The quantity of a security held in a portfolio at a given date, derived by replaying the ledger; never stored or edited directly.
_Avoid_: holding (as a stored record), line

**PMP** (prix moyen pondéré):
The weighted average purchase price per share of a position, fees included. It is the cost basis for realised and unrealised gains.
_Avoid_: average cost, average price, cost price, PRU

**User dividend**:
The net dividend amount a user confirms they actually received for a holding. Only user dividends enter the ledger and count toward returns; a suggestion derived from a reference dividend does not count until confirmed.
_Avoid_: dividend (unqualified)

**SGI** (Société de Gestion et d'Intermédiation):
A licensed BRVM broker through which a user buys and sells securities.
_Avoid_: broker, bank

### Returns

**XIRR** ("Mon rendement"):
The money-weighted annualised return of a user's portfolio, which accounts for the timing and size of the user's own contributions, withdrawals and dividends. It answers "how did my money do?".
_Avoid_: IRR, yield, ROI, performance (unqualified)

**TWR** (time-weighted return):
The return of a portfolio with the effect of the user's cash-flow timing removed, used to compare the portfolio fairly with a benchmark such as the BRVM Composite.
_Avoid_: Mon rendement, performance (unqualified)

### Money

**XOF**:
The West African CFA franc, the currency in which every amount is stored and computed.
_Avoid_: CFA, FCFA (in code and data)

**Peg rate**:
The fixed rate of 655.957 XOF per EUR, used only to display amounts in EUR.
_Avoid_: exchange rate, FX rate (it never floats)
