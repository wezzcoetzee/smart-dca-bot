# Design Docs

Architecture decisions and system design for smart-dca-bot.

## Documents

### [Core Beliefs](./core-beliefs.md)

Foundational design decisions that shape how the system is built: DB-backed configuration, priority-based multiplier evaluation (no stacking), dual DCA tracking for strategy comparison, and the module-mock testing seam. Read this before making architectural changes.

### [Multiplier Strategy](./multiplier-strategy.md)

How the bot determines purchase amounts using four on-chain indicators ranked by importance. Covers trigger logic, evaluation order, data sources, configuration schema, and alternatives that were considered. Read this before modifying `lib/strategy.ts` or the `multiplier_configuration` table.
