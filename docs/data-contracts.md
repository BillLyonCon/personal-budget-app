# Data Contracts

## Purpose

Define v1 input and output contracts for manual entry and statement imports.

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

Fields:
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

## ImportBatch

Fields:
- id: string
- createdAt: string (ISO timestamp)
- sourceType: string (paste | csv | xls)
- sourceName: string optional
- totalRows: integer
- acceptedRows: integer
- rejectedRows: integer

## Import Input Contracts

## Paste Import Row

Required columns:
- transactionDate
- merchant
- amount

Optional columns:
- postDate
- description
- category
- account

Rules:
- amount must parse as positive number
- dates must be valid ISO-like date or mappable format
- empty merchant rows rejected

## CSV/XLS Import

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
- totalObligations: number
- totalVariableExpenses: number
- netResult: number
- savingsContribution: number

Formula:
- netResult = totalIncome - (totalObligations + totalVariableExpenses)

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
