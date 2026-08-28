# Requirements

## Product Goal

Give a single user clear monthly visibility into spending, income, and savings progress using manually entered and imported transaction data.

## Personas

- Primary user: individual managing personal and household budget

## Functional Requirements

1. Income management
- User can add, edit, and delete income entries by month.
- User can mark income as recurring.

2. Fixed obligations management
- User can add, edit, and delete mortgage and loan obligations.
- User can set due date and expected monthly amount.

3. Expense ingestion
- User can paste tabular transaction text.
- User can upload CSV and XLS statement files.
- System validates schema and reports row-level errors.

4. Categorization
- User can map transactions to budget categories.
- User can override category on any transaction.

5. Budget vs actual
- User can define monthly budget per category.
- System shows category variance amount and percentage.
- System shows total monthly net: income minus expenses.

6. Savings goals
- User can define rainy day and retirement goals.
- System tracks current saved amount and progress percent.
- System shows remaining amount and estimated months to target (basic projection).

7. Dashboard and trends
- User can view monthly summary cards.
- User can view category bar chart and monthly trend line.
- User can switch months and compare with prior month.

## Non-Functional Requirements

- Responsive layout for mobile and desktop browsers.
- Local-first storage for v1.
- Fast load for up to 24 months of data and 20k transactions.
- Clear validation messaging for import and calculation failures.

## Non-Goals (v1)

- Direct bank account integration.
- Multi-user household sharing.
- AI-driven classification.
- Tax optimization workflows.

## Acceptance Criteria (MVP)

1. User can import at least one CSV statement and see categorized expenses on dashboard.
2. User can manually enter monthly income and obligations and see net monthly result.
3. User can view category-level variance with amount and percent.
4. User can track rainy day and retirement goal progress with current percent complete.
5. App is usable on phone-width viewport and desktop-width viewport.
