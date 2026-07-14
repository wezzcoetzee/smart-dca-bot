# Agent Roles and Boundaries

This document defines agent responsibilities and the context each agent must read before working in this codebase.

---

## Trading Logic Agent

**Responsible for**: Strategy engine, multiplier evaluation, Hyperliquid spot order execution, Hyperliquid price feeds, transaction recording, Discord notifications, API key encryption and expiry handling.

**Boundaries**: Does not touch UI components, API route handlers, or database schema migrations. Does not modify infrastructure files.

**Files owned**:
- `lib/strategy.ts` — multiplier evaluation and DCA orchestration
- `lib/hyperliquid-bot.ts` — Hyperliquid spot order execution, balance queries, `TransactionSentError`
- `lib/hyperliquid.ts` — Hyperliquid price feed and SMA calculation
- `lib/notifications.ts`, `lib/discord.ts` — notification fan-out and Discord webhook delivery
- `lib/encryption.ts` — AES-256-GCM for the Hyperliquid API private key
- `lib/key-expiry.ts` — 180-day API key expiry warning
- `lib/app-config.ts` — `AppConfiguration` read/write

**Read before working**:
- `docs/design-docs/multiplier-strategy.md` — multiplier priority rules, indicator types, trigger conditions
- `ARCHITECTURE.md` — execution flow, module-mock testing seam
- `docs/RELIABILITY.md` — retry logic, `TransactionSentError` semantics, double-spend guard
- `docs/SECURITY.md` — API private key encryption, `DB_ENCRYPTION_KEY` handling, log redaction

---

## Frontend Agent

**Responsible for**: Dashboard, settings pages, Swagger docs page, shared UI components, design system adherence.

**Boundaries**: Does not modify `lib/` business logic, Prisma schema, or infrastructure files. API route changes limited to response shape adjustments coordinated with the trading logic agent.

**Files owned**:
- `app/` — all pages and API routes
- `components/` — shared UI components
- `hooks/` — React hooks

**Read before working**:
- `docs/DESIGN.md` — color tokens, typography, component specs (pure black backgrounds, white text, red/green for price movement only)
- `docs/FRONTEND.md` — stack, directory layout, data-fetching and component conventions
- `ARCHITECTURE.md` — API route inventory, data models

---

## Testing Agent

**Responsible for**: Unit tests, integration tests, `mock.module()`-based module mocking, test coverage gaps.

**Boundaries**: Does not modify production code except to export a symbol needed for testability. Keep each test file runnable in its own process — `mock.module()` state leaks across a process, which is why `run-tests.sh` runs files individually.

**Files owned**:
- `lib/*.test.ts`, `app/api/**/*.test.ts` — all test files
- `run-tests.sh`

**Read before working**:
- `ARCHITECTURE.md` — module-mock testing seam, dual DCA tracking
- `docs/design-docs/multiplier-strategy.md` — multiplier priority rules and all trigger conditions (needed for strategy test cases)
- `docs/QUALITY_SCORE.md` — test conventions (`mock.module()`, `mock.restore()`, env save/restore)
- `docs/RELIABILITY.md` — retry behavior and `TransactionSentError` semantics to verify correct test coverage
- `lib/logger.ts` — `TEST_MODE` flag and `getLogBuffer()` / `clearLogBuffer()` utilities

---

## Infrastructure Agent

**Responsible for**: Dockerfiles, deployment scripts, CI/CD workflows, database migrations, environment variable documentation.

**Boundaries**: Does not modify application code in `lib/` or `app/`. Schema changes must be coordinated with the trading logic agent.

**Files owned**:
- `Dockerfile`, `Dockerfile.cron`
- `scripts/cron.ts`
- `prisma/` — schema and migrations
- `.github/` — CI workflows (`pr-checks.yml`), CODEOWNERS, Dependabot

**Read before working**:
- `ARCHITECTURE.md` — two-container deployment model, port assignments, health check endpoints
- `docs/SECURITY.md` — non-root user requirement, `DB_ENCRYPTION_KEY` ENV-only constraint, `CRON_SECRET` auth
- `docs/RELIABILITY.md` — health check configuration, metrics endpoint

---

## Cross-Agent Coordination

When a change touches multiple domains, agents must agree on the interface before either begins implementation.

| Boundary | Owned by | Consumed by |
|----------|----------|-------------|
| `AppConfig` interface in `lib/app-config.ts` | Trading Logic | Frontend (settings), Infrastructure (env docs) |
| API response shapes in `app/api/` | Frontend | Trading Logic (cron route) |
| Prisma schema in `prisma/schema.prisma` | Infrastructure | All agents |
| Metrics in `lib/metrics.ts` | Trading Logic | Infrastructure (Prometheus scrape config) |
