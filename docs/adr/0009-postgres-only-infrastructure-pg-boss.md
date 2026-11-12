# Postgres-only infrastructure, with pg-boss for jobs

## Context

The backend template shipped with Postgres, Redis, BullMQ, a WebSocket gateway with a Redis bridge, S3 storage and Firebase. Doni's workload is small: one daily ingestion, daily alerts, and request/response traffic, with end-of-day data that never needs pushing in real time. Each extra service adds cost, configuration and failure modes for a small team.

## Decision

The backend runs with **Postgres as its only infrastructure dependency**. Background and scheduled jobs run on **pg-boss** (a Postgres-backed queue). Rate limiting works in-process for a single instance. Redis, BullMQ, the WebSocket gateway, S3 and Firebase are removed. Original BOC PDFs are stored in Postgres.

## Rejected alternatives

- **Redis + BullMQ**: an extra managed service for a handful of daily jobs.
- **WebSockets for live updates**: prices are end-of-day; there is nothing to stream.
- **S3 / object storage for PDFs**: volume is a few small PDFs per trading day.
- **Platform cron (e.g. hosting provider scheduler)**: ties scheduling to the host and lacks retries and job history.

## Consequences

- One service to provision, back up and restore.
- Scaling beyond one backend instance requires revisiting rate limiting (shared store) before it happens.
- If file volume grows, object storage can be reintroduced behind the same storage interface.
