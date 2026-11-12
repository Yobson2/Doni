# Corporate actions: restated price history, whole shares, rights issues as buys

## Context

Splits, reverse splits, free-share allotments and rights issues change the quantity or terms of a security held. ADR 0006 already says a corporate action adjusts quantity and PMP while preserving total cost. Three questions remained: how to show a price history that crosses a split (a 1:5 split makes the BOC close drop to a fifth overnight), what to do with fractions of a share, and what a rights issue does to a position, given that subscribing is each holder's own choice.

## Decision

- **Corporate actions are reference data** entered by an admin from their BRVM notice (effective date, ratio, optional cash-in-lieu price, subscription price for a rights issue, notice link) and shared by all users. The ledger engine applies the ones in effect (effective date on or before today) during replay, in date order and before that day's ledger entries: a trade dated on or after the effective date is already in new shares. The notice link is shown to users with every action.
- **Ratio**: "received shares for every held". For a split or reverse split the held shares are replaced; for free shares the received shares are added.
- **Price history is restated in today's shares** (an adjusted series), not a raw series with a marker. Each price dated before a split, reverse split or free-share allotment in effect is divided by its quantity factor. The BOC close is kept next to it (`publishedClose`), the chart marks each action's effective date, and the page says prices are adjusted. A position valued at a price from before an action uses the restated price too. Why: users compare the chart with their PMP and quantity, which are already adjusted; a raw series shows a fall that never happened and makes a correct position look like a loss. Keeping the published close and the marker preserves the BOC provenance (ADR 0003). Volumes are not restated.
- **Shares are whole.** When a ratio leaves a fraction of a share (a reverse split, or free shares on a holding that is not a multiple of the ratio), the holder keeps the whole shares, rounded down, and the fraction is settled in cash, which is BRVM practice ("indemnisation des rompus"). If the notice states the cash paid per share, the fraction is treated as sold at that price and realises a gain or loss against the PMP. If it does not, nothing is invented: the fraction's cost stays in the whole shares kept (total cost preserved, slightly higher PMP), and only when no whole share is left is the cost realised as a loss.
- **A rights issue does not change positions by itself.** It is recorded and shown with its notice, terms and subscription price, but the engine leaves quantity and PMP unchanged. A holder who subscribes records the new shares as a buy at the subscription price. Rights themselves (the detachable, tradeable "DPS") are not modelled: no value is moved out of the PMP when they detach, prices are not restated for them, and selling rights cannot be recorded yet.

## Rejected alternatives

- **Raw price series with only a marker**: simpler and closer to the BOC, but the chart and the position disagree by the split factor.
- **Fractional shares in positions**: matches the arithmetic exactly but shows holdings no SGI statement has.
- **Always realising the fraction at the last close when no cash-in-lieu price is given**: invents an amount the holder may not have received.
- **Applying a rights issue automatically as a subscription, or modelling rights as a separate holding**: subscription is each holder's choice, and rights need their own ledger entries (detachment, sale, lapse).

## Consequences

- An admin who enters an action with the wrong ratio changes every holder's positions until it is corrected; actions can be corrected or removed.
- An action that makes an existing ledger invalid (a later sale now exceeds the adjusted quantity) is not refused at entry; it surfaces when that portfolio is next replayed.
- Selling rights and the detachment value of rights are left for a later decision.
