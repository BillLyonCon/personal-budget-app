# Personal Budget App

A personal budget tracker for desktop and mobile browsers.

This project is a fresh start, inspired by the useful parts of the corporate budget tool (variance logic and charting patterns) while removing corporate-only workflow.

## Vision

Track monthly financial health in one place:
- Expense tracking from bank and credit card CSV statements
- Auto-categorization using vendor mappings
- Budget vs actual variance
- Savings progress for rainy day fund and retirement

## MVP Scope (v1)

Included:
- Expense import from bank and credit card CSV files
- Auto-categorization using vendor mappings
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

1. Import bank and credit card statement CSVs through Import Pipeline.
2. Transactions auto-categorized using vendor mappings.
3. Review dashboard with monthly totals and variance.
4. Adjust categories as needed.
5. Track savings goals and annual budget progress.

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
