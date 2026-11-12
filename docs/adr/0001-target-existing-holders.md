# Target user: existing BRVM holders

## Context

BRVM investors have few tools for tracking what they own: SGIs send paper or PDF statements, and market data is spread across BOC PDFs. Doni could aim at several audiences: people who already hold BRVM securities, first-time investors who have not bought anything yet, or professionals.

## Decision

The primary user is someone who **already holds BRVM securities** and wants to see what they are worth and how they have performed. Every MVP feature is judged first by whether it serves that person. Onboarding is built around getting an existing holder to a valued portfolio in about two minutes (opening position first, full trade entry second). First-time investors are a secondary audience, served by guides and the SGI directory, which also bring people in.

## Rejected alternatives

- **First-time investors as the primary user.** They have nothing to track yet, so the core portfolio value would not apply to them; serving them first leads towards education and simulation features (quizzes, virtual portfolio) that we deferred.
- **Professionals (SGI staff, analysts).** They need live data, screeners and technical analysis, which require data licences and scope we do not have.
- **A general BRVM news/data site with no portfolio.** Low switching value; the BRVM site and press already cover it.

## Consequences

- Opening positions exist so holders do not have to re-enter years of trades.
- The portfolio, corporate actions and dividends are core MVP scope; screener, technical analysis and simulation features are deferred (see `ROADMAP.md`).
