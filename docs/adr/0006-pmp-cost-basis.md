# PMP as the cost basis

## Context

Realised and unrealised gains need a cost basis. Common methods are weighted average cost, FIFO, LIFO and specific lot identification. Francophone West African investors and SGI statements use the **PMP** (prix moyen pondéré).

## Decision

The cost basis of every position is the **PMP**: the weighted average purchase price per share, fees included. Buys update the PMP; sells realise a gain against the current PMP and leave it unchanged; corporate actions adjust quantity and PMP while preserving total cost. An opening position supplies its own PMP.

## Rejected alternatives

- **FIFO / LIFO**: not what users see on SGI statements, so numbers would not match; also requires tracking lots.
- **Specific lot identification**: needs lot-level data users do not have, and contradicts opening positions entered as a single quantity and PMP.

## Consequences

- Doni's figures can be checked line by line against SGI statements.
- No lot tracking in the ledger engine.
- If a future tax regime requires another method, it would be an additional computation, not a change to the ledger.
