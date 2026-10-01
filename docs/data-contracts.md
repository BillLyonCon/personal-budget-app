# Data Contracts

## Purpose

Define v1 input and output contracts for CSV statement imports.

## Core Types

## IncomeEntry

Fields:
- id: string
- month: string (YYYY-MM)
- source: string
- amount: number (>= 0)
- recurring: boolean
- notes: string optional

## ObligationEntry

Fields:
- id: string
- month: string (YYYY-MM)
- type: string (mortgage | loan | other-fixed)
- name: string
- amount: number (>= 0)
- dueDay: integer (1-31)
- notes: string optional

## ExpenseEntry

Fields:
- id: string
- transactionDate: string (YYYY-MM-DD)
- postDate: string optional (YYYY-MM-DD)
- merchant: string
- description: string optional
- amount: number (> 0)
- category: string
- account: string optional
- importBatchId: string optional

## BudgetCategory

**Input Contract (from `data/config/Budget.csv`):**

Fields:
- Category: string
- Subcategory: string
- Monthly Budget: number (currency, >= 0)

Notes:
- Static monthly configuration, loaded on app startup
- 23 categories with monthly budget totals
- Current verified total: $10,280.58 monthly
- Annual Budget = Monthly Budget x 12
- Used for Monthly Budget KPI and Budget vs Actual variance calculation

**Internal Application Type (for reference):**

If storing computed category budgets:
- id: string
- month: string (YYYY-MM)
- name: string
- budgetAmount: number (>= 0)

## SavingsGoal

Fields:
- id: string
- name: string (rainy-day | retirement | custom)
- targetAmount: number (> 0)
- currentAmount: number (>= 0)
- targetDate: string optional (YYYY-MM)

## BankRule

**Input Contract (from `data/config/Bank rules.csv`):**

Fields (exact columns depend on CSV):
- Pattern-matching criteria (e.g., Description substring, amount range)
- Target category

Notes:
- 26 rules, loaded on app startup
- CSV rule order is preserved
- First matching rule wins for transaction categorization
- Used to auto-categorize bank transactions
- Case-insensitive substring matching on description field

## ImportBatch

Fields:
- id: string
- createdAt: string (ISO timestamp)
- sourceType: string (csv)
- sourceName: string optional
- totalRows: integer
- acceptedRows: integer
- rejectedRows: integer

## Import Input Contracts

## CSV Import

Minimum required columns (case-insensitive mapping):
- date or transactionDate
- merchant or description
- amount

Optional mapped columns:
- postDate
- category
- account

Validation behavior:
- invalid rows are rejected with row index and reason
- valid rows are accepted and normalized into ExpenseEntry

## Output Metrics Contract

## MonthlySummary

Fields:
- month: string (YYYY-MM)
- totalIncome: number
- totalBudget: number (from Budget.csv monthly total)
- monthlyActual: number (Budget-mode knownExpensesTotal: bank expenses + credit card purchases)
- netResult: number
- savingsContribution: number

Formula:
- totalBudget = Budget.csv monthly total (e.g., $10,280.58)
- monthlyActual = Budget-mode knownExpensesTotal (bank-observed + card-observed expenses)
- netResult = totalIncome - monthlyActual
- annualBudget = totalBudget x 12
- variance = totalBudget - monthlyActual

## CategoryVariance

Fields:
- month: string (YYYY-MM)
- category: string
- budgetAmount: number
- actualAmount: number
- varianceAmount: number
- variancePercent: number

Formula:
- varianceAmount = budgetAmount - actualAmount
- variancePercent = if budgetAmount > 0 then (varianceAmount / budgetAmount) * 100 else 0

## GoalProgress

Fields:
- goalName: string
- targetAmount: number
- currentAmount: number
- progressPercent: number
- remainingAmount: number

Formula:
- progressPercent = if targetAmount > 0 then (currentAmount / targetAmount) * 100 else 0
- remainingAmount = max(targetAmount - currentAmount, 0)
