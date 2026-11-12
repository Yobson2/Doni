# EU hosting with point-in-time recovery

## Context

Doni holds personal financial data and the ledger is the single source of truth: losing it cannot be recovered from anywhere else. Managed hosting is not available with comparable quality inside the UEMOA region. Users expect data protection comparable to GDPR.

## Decision

Production runs with **managed Postgres in an EU region** with **daily backups and point-in-time recovery**. The frontend is on Vercel and the backend runs as one managed container. Migrations run on deploy. A **restore drill** into a scratch database is performed and documented before relying on the backups. Error tracking and uptime monitoring are in place from the first deploy.

## Rejected alternatives

- **Self-managed VPS with a self-run database**: backups and recovery depend on our own discipline.
- **US region hosting**: weaker alignment with the data-protection expectations we hold ourselves to and higher latency to West Africa than EU regions.
- **Local (UEMOA) hosting**: no managed Postgres with PITR at an acceptable level of reliability today.
- **Backups without PITR**: up to a day of ledger entries could be lost.

## Consequences

- Personal data is stored outside the UEMOA; the privacy policy states this.
- Restore procedures are documented and rehearsed, not assumed.
