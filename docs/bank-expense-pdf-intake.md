# Bank Expense PDF Intake

Use this for non-credit-card bank expense statements, such as Chase Zelle payments for mailed checks.

## Primary workflow: Upload via web UI

**Recommended approach:**
- Open the Personal Budget app in your browser
- Go to the **Import Pipeline** tab
- Use the file upload fields to select your PDF or paste activity
- Click "Show Results in UI" to process

CSV-first recommendation:
- If Chase Direct Download offers Spreadsheet (Excel, CSV), use CSV as the primary intake format via web UI.
- Use PDF/web-paste only as fallback.

Source-of-truth rule:
- Treat bank statement CSV as authoritative for Zelle/check-mailing expenses.
- Do not combine Zelle web-paste data with bank CSV for the same date range.

## Advanced: Manual folder-based processing

**For developers or batch workflows only:**

- Incoming statements: data/raw/expenses/bank-statements
- Parsed outputs: data/processed/expenses/bank-statements

### Web paste fallback (via UI or manual)

If PDF extraction is poor, copy and paste payment activity from the bank website into the Import Pipeline.

For manual batch processing:
- Paste source text file:
  - data/raw/expenses/bank-statements/zelle-payment-activity-paste.txt
- Parse command:
  - ./scripts/parse-payment-activity-paste.ps1
- Parsed output:
  - data/processed/expenses/bank-statements/zelle-payment-activity-parsed.csv

Notes:
- Parser extracts send date, deliver date, status, payee, amount.
- Pending items are retained but marked includeInObservedExpenses=false.

## Income backfill companion

If income statements do not cover all months in the expense window, fill:
- data/raw/income/monthly-income-backfill.csv

Then rerun:
- ./scripts/build-income-vs-expense-snapshot.ps1

## Naming convention

- chase-zelle-YYYY-MM.pdf
- If statement spans multiple months:
  - chase-zelle-YYYY-MM_to_YYYY-MM.pdf

Current file note:
- zelle_pay_june.pdf should be treated as potentially multi-month.
- Derive month from each transaction date during parsing.

## Multi-month handling

- Statements can span more than one month.
- Month must be derived from each transaction date.
- Keep a consolidated parsed file and optional per-month split files.

## Minimum parsed columns

- transactionDate (YYYY-MM-DD)
- merchant
- description
- amount
- account
- sourceStatement

## Rule for Zelle check mailing expenses

- Treat as expense outflows.
- Do not classify as income.
- Keep original payee/description text for audit trail.
- For zelle_pay_june.pdf, default category is zelle-pay-check-mailing unless a more specific subcategory is provided later.
