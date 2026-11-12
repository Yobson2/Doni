# French and English, French by default

## Context

The BRVM's member countries are mostly francophone, and BRVM documents (BOC, notices) are in French. A meaningful share of potential users (Guinea-Bissau, diaspora, foreign investors) prefer English. Retrofitting translation later is expensive.

## Decision

The app ships in **French and English from the start**, with **French as the default**. There are no hard-coded UI strings; a language switch persists across reloads. Guides exist in both languages. Company profiles carry both languages, and translations are marked as such. Domain terms keep their French names where users know them (PMP, BOC, SGI, "Mon rendement").

## Rejected alternatives

- **French only**: excludes English-speaking investors.
- **English default**: does not match the main audience or the source documents.
- **Machine translation at runtime**: unreliable for financial terminology.

## Consequences

- Every feature needs strings in both languages before it ships.
- Number and date formatting follows the active locale.
