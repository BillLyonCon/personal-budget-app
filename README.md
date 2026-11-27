# Personal Budget App

A personal budget tracker for desktop and mobile browsers.

This project is a fresh start, inspired by the useful parts of the corporate budget tool (variance logic and charting patterns) while removing corporate-only workflow.

## Vision

Track monthly financial health in one place:
- Expense tracking from bank and credit card CSV statements
- Auto-categorization using Bank rules
- Budget vs actual variance
- Savings progress for rainy day fund and retirement

## MVP Scope (v1)

Included:
- Expense import from bank and credit card CSV files
- Auto-categorization using Bank rules (26 rules in data/config/Bank rules.csv)
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

## Session Start and Session End Protocol

### Mandatory Session Startup Checklist

Before making any code changes, AI assistants must:

1. Read `README.md` completely.
2. Read the most recent session log in `/session-logs`.
3. Summarize:
   - Current architecture
   - Current development phase
   - Open work items
   - Known risks
4. Confirm the current Git branch and commit:
   ```bash
   git branch --show-current
   git rev-parse --short HEAD
   ```
5. Do not modify code until the review is complete.

---

### Development Rules

- Make the smallest change necessary.
- Verify functionality after each completed change.
- Avoid unrelated refactoring.
- Maintain backward compatibility whenever possible.
- Do not assume a feature is safe because tests pass.
- Verify actual application behavior.

---

### Mandatory Recovery Rule

If the application becomes unstable:

1. Stop feature development.
2. Identify the last known-good working commit.
3. Create a recovery branch before any repair attempts:
   ```bash
   git switch -c recovery-<commit>
   ```
4. Push the recovery branch:
   ```bash
   git push -u origin recovery-<commit>
   ```

---

### Mandatory Session Completion Checklist

A coding session is **not complete** until one of the following occurs:

#### Option A - Successful Completion

1. Verify:
   - Dashboard works
   - Import Pipeline works
   - File selection works
   - Existing functionality still works

2. Update the session log.

3. Review Git status:
   ```bash
   git status
   ```

4. Commit all successful work:
   ```bash
   git add .
   git commit -m "<meaningful description>"
   ```

5. Push to GitHub:
   ```bash
   git push
   ```

6. Record:
   - Branch name
   - Commit hash
   - Summary of changes

#### Option B - Work in Progress

If the session is ending without a final commit:

1. Create a checkpoint branch:
   ```bash
   git switch -c checkpoint-<date>
   ```

2. Push the checkpoint branch:
   ```bash
   git push -u origin checkpoint-<date>
   ```

3. Record the checkpoint in the session log.

---

### Explicit Instruction for AI Assistants

Before ending any successful coding session, remind the user to:

1. Review `git status`.
2. Commit the working state.
3. Push the commit or checkpoint branch to GitHub.

Do not assume this step has already been performed.

## Workflow Summary

1. Import bank and credit card statement CSVs through Import Pipeline.
2. Transactions auto-categorized using Bank rules (data/config/Bank rules.csv).
3. Review dashboard with Monthly Budget, Monthly Actual (expenses in Budget-mode), and Net Result.
4. Adjust categories as needed.
5. Track savings goals and annual budget progress.

## Data Files

**Budget Configuration:** `data/config/Budget.csv`
- Source of truth for budget categories and monthly budget amounts
- Columns: Category, Subcategory, Monthly Budget
- 23 categories with monthly budget totals ($10,280.58 current verified total)
- Loaded on app startup for Monthly Budget KPI and annual budget calculation
- Monthly Budget x 12 = Annual Budget

**Bank Categorization Rules:** `data/config/Bank rules.csv`
- 26 rules that auto-categorize bank transactions
- First matching rule wins; CSV rule order is preserved
- Loaded on app startup for expense classification
- Applies to both bank transfers (ACH, billpay, Zelle) and credit card purchases

**Transaction Data:** Import via Import Pipeline tab
- Bank statements: CSV files in `data/raw/`
- Credit card statements: CSV files in `data/raw/` with CATEGORY column
- Stored in localStorage after import; persists across page reload

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
