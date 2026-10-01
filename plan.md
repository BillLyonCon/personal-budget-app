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
- IncomeEntry (planned, not yet implemented)
- ObligationEntry (planned, not yet implemented)
- ExpenseEntry
- BudgetCategory (input: Budget.csv with Category, Subcategory, Monthly Budget columns)
- SavingsGoal (planned, not yet implemented)
- ImportBatch
- BankRule (26 CSV-based rules for auto-categorization)

Exit criteria:
- Data model documented and reviewed ✅
- Budget.csv finalized with 23 categories, $10,280.58 monthly total ✅
- Bank rules.csv finalized with 26 rules, first-match-wins behavior ✅
- Sample records verified against data contracts ✅

## Phase 3 - Import and Calculation Engine

Goals:
- Parse CSV statement data from bank and credit card uploads
- Calculate monthly totals and variance
- Produce dashboard-ready metrics

Calculation outputs:
- Total income
- Monthly Actual (Budget-mode knownExpensesTotal for apples-to-apples comparison)
- Net Result (Income Total - Budget-mode knownExpensesTotal)
- Monthly Budget (from Budget.csv)
- Annual Budget (Monthly Budget x 12)
- Category-level variance
- Savings progress percent

Exit criteria:
- Import matrix passes for clean and messy inputs ✅
- Formula outputs validated with fixed test set ✅
- Bank categorization uses Bank rules.csv with first-match-wins ✅
- Monthly Actual KPI consistent with Budget-mode expenses ✅
- Net Result aligned with Budget-mode Monthly Actual ✅
- Regression verification: PASS ✅

## Phase 4 - API and UI

Goals:
- Create responsive interface for mobile and desktop
- Show trends and category charts
- Support correction loop for mapped categories

Views:
- Dashboard ✅ (Monthly Budget, Monthly Actual, Net Result KPIs; category chart; monthly trend)
- Transactions (planned)
- Income and obligations (planned)
- Goals (planned)
- Settings/import ✅ (CSV import pipeline)

Local server:
- serve.js created to run app locally on port 8000 ✅
- Fixed URL-decoding issue for Bank%20rules.csv HTTP requests ✅
- Budget.csv and Bank rules.csv load successfully on app startup ✅

Exit criteria:
- Core workflows complete on phone and desktop viewports (in progress)
- Data roundtrip tested end-to-end ✅

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
