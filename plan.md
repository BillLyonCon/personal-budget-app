# Implementation Plan

## Objective

Build a personal budget application from scratch with mobile and desktop browser support, local-first storage, and strong progress traceability via session logs.

## Decisions Locked

- Repository: personal-budget-app
- Delivery order: web app first
- Storage: local-only in v1
- Import methods: CSV file upload (bank and credit card statements)
- Playwright capture: deferred to post-MVP

## Phase Plan

## Phase 1 - Foundation

Goals:
- Establish planning and operating documentation
- Define scope boundaries and success metrics
- Establish session-log protocol

Deliverables:
- README.md
- plan.md
- docs/requirements.md
- docs/data-contracts.md
- session-logs/session-log-template.md
- first dated session log

Exit criteria:
- Documentation complete and consistent
- Session logging process in use

## Phase 2 - Domain and Data Model

Goals:
- Define entities and relationships
- Define monthly workflow and status metrics

Core entities:
- IncomeEntry
- ObligationEntry
- ExpenseEntry
- BudgetCategory
- SavingsGoal
- ImportBatch

Exit criteria:
- Data model documented and reviewed
- Sample records verified against data contracts

## Phase 3 - Import and Calculation Engine

Goals:
- Parse CSV statement data from bank and credit card uploads
- Calculate monthly totals and variance
- Produce dashboard-ready metrics

Calculation outputs:
- Total income
- Total obligations
- Total variable expenses
- Net monthly result
- Category-level variance
- Savings progress percent

Exit criteria:
- Import matrix passes for clean and messy inputs
- Formula outputs validated with fixed test set

## Phase 4 - API and UI

Goals:
- Create responsive interface for mobile and desktop
- Show trends and category charts
- Support correction loop for mapped categories

Views:
- Dashboard
- Transactions
- Income and obligations
- Goals
- Settings/import

Exit criteria:
- Core workflows complete on phone and desktop viewports
- Data roundtrip tested end-to-end

## Phase 5 - Validation and Release Prep

Goals:
- Formalize test checklist
- Resolve blockers and polish UX
- Prepare v1 release notes

Exit criteria:
- All MVP acceptance criteria passed
- Open risks documented with mitigation

## Session Logging Protocol

Required checkpoints each session:
1. Start update: goals and plan
2. Midpoint update: decisions and blockers
3. End update: outcomes and carry-forward tasks

Each entry must include:
- Timestamp
- Objective
- Tasks completed
- Files touched
- Validation performed
- Blockers
- Decisions
- Next actions

## Risk Controls

- Scope creep: enforce non-goals from requirements
- Data quality: strict validation and error messaging
- Mobile usability: test on narrow viewports every sprint
- Formula drift: lock regression test cases early
