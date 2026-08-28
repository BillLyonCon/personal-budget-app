# Annual Budget Intake - 2026-07

**STATUS: DEPRECATED** — This process is no longer used. See csv-intake-workflow.md for current vendor mapping approach.

## Source (Legacy)

Budget sheet provided by user as screenshot (annual expenses, some estimated, some calculated).

## Captured dataset

Raw capture file:
- data-samples/annual-budget-expenses-2026-raw.csv

## Quick validation checks

- Sum row (monthly): 8842.00
- Sum row (yearly): 106104.00
- Monthly x 12: 106104.00
- Delta between yearly sum and monthly x 12: 0.00

## Contract mapping guidance

This source is a planning budget sheet, not transaction history. It best maps to:
- BudgetCategory for category-level budgets
- ObligationEntry for recurring fixed costs

Suggested mapping to start (confirm with user before locking):

Potential ObligationEntry items:
- mort
- Climate First solar loan
- car payments
- car insurance
- Pest visit QTR
- phone
- internet
- elias phone

Potential BudgetCategory items:
- water
- pool
- food
- gas
- maint
- elias
- teeth
- health
- penny vet visits
- penny meds
- Dog tracker
- streaming
- amazon

## Normalization rules proposed for parser

- Keep source annual and monthly values when provided.
- Normalize to monthly planning amount for calculations.
- If quarterly amount exists and monthly is missing, use quarterly / 3.
- If yearly amount exists and monthly is missing, use yearly / 12.
- If both monthly and yearly exist and differ by > 0.50, flag as warning.
- Exclude SUM from imports.

## Open decisions needed from user

- Confirm month to attach for initial load (for example: 2026-07).
- Confirm exact category names (especially: elias, teeth, maint).
- Mark which entries are estimated vs calculated in a dedicated field.

## Later clarification captured

- Two credit cards are in scope:
	- Amazon card
	- Day-to-day expenses card
- Rollup placeholders for these cards are deferred from contract imports and replaced by detailed card-statement categories to avoid double counting.
