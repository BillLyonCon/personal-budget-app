# CSV Intake Workflow

## Vendor Mapping CSV (Budget Category Configuration)

**Purpose:** Configure vendor-to-category mappings for automatic transaction categorization during import.

**Source file:** `data/blyon budget.csv` (user-editable)  
**App reads from:** `data/processed/vendor-category-mapping.csv` (generated from source)

**Setup:**
1. Edit `data/blyon budget.csv` directly to add/modify vendor patterns
2. Refresh app — it automatically detects changes and loads new mappings
   - Or manually check: When `blyon budget.csv` is modified, run sync to copy to `vendor-category-mapping.csv`
3. On app startup, vendor mappings load from `vendor-category-mapping.csv`

**CSV columns from blyon budget.csv:**
- `Budget Category` — Category name (e.g., "Mortgage", "Groceries", "Utilities")
- `Monthly` — Monthly budget amount for this category
- `Daily` — Optional daily breakdown (for variable expenses)
- `QTR` — Optional quarterly budget amount
- `Annual` — Annual budget total (for reference/verification)
- Column 6 — Budget type: **FIXED** (recurring/stable) or **ESTIMATED** (variable/average)
- `VENDOR (comma delimited) - from Bank statement CSV Description column` — Comma-delimited merchant patterns matched against **both bank and credit card transaction descriptions** for automatic categorization
- `CHASE CREDIT CARD CATEGORY - from card statements- CATEGORY column` — Reference only; shows what Chase calls this category (not used in matching)

**How vendor matching works during transaction import:**
1. When you upload bank/credit card CSV files, each transaction's merchant description is checked against the VENDOR column patterns
2. Matching is case-insensitive with two-tier approach:
   - **Exact match** (after lowercase/space normalization): e.g., "netflix.com" matches "NETFLIX.COM"
   - **Partial match fallback**: e.g., "publix" matches "PUBLIX SUPER MARKET" 
3. **Vendor matching applies to both bank and card transactions** — uses same logic for both
4. If vendor matches → transaction categorized automatically
5. If no match → falls back to built-in inference heuristics
6. Category actuals tracked separately for budget variance reporting

**Example rows:**
```
Budget Category,Monthly,Daily,QTR,Annual,,VENDOR (comma delimited) - from Bank statement CSV Description column,CHASE CREDIT CARD CATEGORY - from card statements- CATEGORY column
Mortgage,"$2,200.00 ",,,"$26,400.00 ", FIXED ,JPMORGAN CHASE   CHASE ACH,
Groceries,"$1,500.00 ",$50.00 ,,"$18,000.00 ", ESTIMATED ,"NORTHWEST SEAFOOD,PUBLIX,Fresh market, Uppercrust,",Groceries
Streaming,$75.00 ,,,$900.00 , ESTIMATED ,"Netflix.com,HBO,QOBUZ",Bills & Utilities
```

**Update workflow:**
1. Edit vendor patterns in `data/blyon budget.csv`
2. Refresh browser — app loads new mappings on startup
3. Re-import bank/credit card CSV files to recategorize with new vendor rules

**Budget Categories Import**
- Budget amounts loaded from `data/processed/budget-category-import.csv`
- Must have entries for each month you want to track (`month` field in YYYY-MM format)
- Category names must match vendor mapping names for budget comparison to work
- If a category appears in transactions but not in budget file, it shows $0 budget

---

## Bank & Credit Card CSV Imports

Use CSV as the primary source when your bank supports direct download.

## Why CSV

- Structured data format ensures accurate parsing.
- Direct import to web UI without extra processing steps.
- Better month-by-month reconciliation.

## Chase.com Export Procedure

### Exporting Account Activity CSV

1. **Access your Chase account**
   - Go to https://secure.chase.com/web/auth/dashboard
   - Log in with your credentials

2. **Navigate to account details**
   - Click on the account link for the account you want to export (e.g., checking, savings, or credit card)

3. **Export transactions**
   - Scroll down to the **Transactions** section
   - Click the export or download button
   - Select **Excel/CSV format**
   - Choose your date range
   - Download the file

4. **Upload to the web UI**
   - Open the Personal Budget app in your browser
   - Go to the **Import Pipeline** tab
   - Use the file upload fields to select your downloaded CSV:
     - **For bank accounts (checking/savings):** "1. Bank statement CSV (income + expenses)"
     - **For credit cards:** "2. Credit card CSV (Amazon card)" or "3. Credit card CSV (day-to-day card)"
   - Click "Show Results in UI" to process the upload

### Quick Link

- Chase direct download page:
  - https://secure.chase.com/web/auth/dashboard#/dashboard/accountDetails/downloadAccountTransactions/index;params=CARD,BAC,810957803

## Processing Your CSV

After uploading your files in the web UI, the app automatically processes them and categorizes transactions using vendor mappings. No additional steps required.

## Advanced: Manual batch processing with scripts

For developers or batch processing workflows, CSVs can also be parsed via command line:

**Where to place files for scripts:**

- Bank account activity CSVs (checking/savings):
  - data/raw/expenses/bank-statements
- Credit card CSVs:
  - data/raw/expenses/credit-cards

### Parse bank transactions CSV

Run:

powershell
./scripts/parse-bank-transactions-csv.ps1 -InputCsv "data/raw/expenses/bank-statements/<your-file>.csv" -TreatAllCreditsAsIncome

Outputs:
- data/processed/expenses/bank-statements/bank-expenses-from-csv.csv
- data/processed/expenses/bank-statements/bank-transactions-csv-rejected.csv

### Parse credit card transactions CSV

Run:

powershell
./scripts/parse-credit-card-activity-csv.ps1 -InputCsv "data/raw/expenses/credit-cards/<your-file>.csv"

Outputs:
- data/processed/expenses/credit-cards/credit-card-transactions-from-csv.csv
- data/processed/expenses/credit-cards/credit-card-transactions-rejected.csv

## Notes

- All transaction data flows through the import pipeline in the app
- Avoid ingesting the same transactions from multiple sources for the same date range to prevent double counting
- Vendor matching is case-insensitive with two-tier approach: exact match first, then substring containment
