# CSV Import Workflow - Bank and Credit Card Statements

## Budget Configuration

### Source of Truth
The application's budget configuration comes from an externally-maintained Excel workbook:
- **Location:** `C:\Users\billlocal\OneDrive\Budget BLyon\CSV Budget import v3\blyon budget v3 reformatted MASTER .xlsx`
- **Purpose:** Human-editable master with detailed budget planning fields
- **Contents:** Budget categories, monthly amounts, daily breakdowns, quarterly amounts, annual totals, cost type (FIXED/ESTIMATED), vendor notes

### Budget Import to Application
When the budget needs to be updated:
1. Edit the external Excel master workbook
2. Export the Budget sheet as a simplified CSV with three columns: Category, Subcategory, Monthly Budget
3. Save the exported CSV as `data/config/Budget.csv`
4. Application automatically loads the updated budget on startup

### Application Budget Configuration
**File:** `data/config/Budget.csv`
- **Columns:** Category, Subcategory, Monthly Budget
- **Current:** 23 categories with $10,280.58 monthly budget total
- **Loaded:** On application startup
- **Usage:**
  - Monthly Budget KPI displays total
  - Annual Budget = Monthly Budget × 12
  - Category-level budget amounts for variance comparison

---

## Bank Transaction Categorization

### Configuration
**File:** `data/config/Bank rules.csv`
- **Contents:** 26 categorization rules
- **Behavior:** First matching rule wins
- **Rule order:** Preserved from CSV (order matters)
- **Matching:** Case-insensitive substring matching on transaction description

### How It Works
1. When you import bank/credit card statements, each transaction's merchant description is checked against the Bank rules
2. If a rule matches → Transaction categorized with that rule's category
3. If no match → Falls back to built-in categorization heuristics
4. Bank rules apply to both bank transfers (ACH, billpay, Zelle) and credit card purchases

---

## Bank & Credit Card CSV Imports

Use CSV as the primary import format for your bank and credit card statements.

### Why CSV
- Structured data format ensures accurate parsing
- Direct import to web UI without extra processing steps
- Better month-by-month reconciliation
- Works with any bank that supports CSV export

### Chase.com Export Procedure

#### Exporting Account Activity CSV

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

#### Quick Link

- Chase direct download page: https://secure.chase.com/web/auth/dashboard#/dashboard/accountDetails/downloadAccountTransactions/index;params=CARD,BAC,810957803

### Processing Your CSV

After uploading your files in the web UI:
1. The app categorizes transactions using Bank rules (stored in data/config/Bank rules.csv)
2. Categorized transactions are grouped by category and month
3. Monthly actuals are compared against budget amounts from data/config/Budget.csv
4. Results display in the dashboard with budget variance analysis
