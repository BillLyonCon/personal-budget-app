# Personal Budget App

A personal budget tracker for desktop and mobile browsers.

This project is a fresh start, inspired by the useful parts of the corporate budget tool (variance logic and charting patterns) while removing corporate-only workflow.

## Vision

Track monthly financial health in one place:
- Income and fixed obligations (mortgage, loans)
- Daily expenses from card statements (paste or CSV/XLS upload)
- Budget vs actual variance
- Savings progress for rainy day fund and retirement

## MVP Scope (v1)

Included:
- Manual entry for income and fixed obligations
- Expense import by paste and CSV/XLS upload
- Category mapping and monthly rollups
- Monthly variance dashboard (income, expense, net)
- Savings goal tracking (rainy day and retirement)

Not included in v1:
- Direct bank API login/sync
- AI auto-categorization
- Multi-user collaboration
- Advanced forecasting

## Platform Strategy

- v1 delivery: web app first (mobile + desktop browser)
- v2 option: desktop packaging (Tauri preferred)
- data strategy: local-first storage in v1

## Initial Repository Layout

- docs/ - requirements, data contracts, architecture notes
- session-logs/ - daily progress logs and template
- app/ - implementation code (to be created in build phase)
- scripts/ - development utilities (to be created in build phase)
- data-samples/ - import examples for testing (to be created in build phase)

## Workflow Summary

1. Import or paste expenses.
2. Enter income and fixed obligations.
3. Review categories and corrections.
4. Compute monthly totals and variance.
5. Review savings progress.
6. Log work session outcomes in session log.

## Progress Tracking

Session logging is required.
- Use session template at session-logs/session-log-template.md
- Create one dated log per work session
- Update at start, midpoint, and end of each session

## Getting Started (Planning Phase)

1. Read plan.md.
2. Read docs/requirements.md.
3. Read docs/data-contracts.md.
4. Start implementation from Phase 1 tasks.

## Roadmap

- Phase 1: Planning docs and project standards
- Phase 2: Data model and import pipeline
- Phase 3: Calculation engine and APIs
- Phase 4: Responsive UI and charts
- Phase 5: Validation, hardening, and release prep
