# Actuals Import Next Step

## Primary workflow: Upload via web UI

**Recommended approach:**
- Open the Personal Budget app in your browser
- Go to the **Import Pipeline** tab
- Use the file upload field for actuals data
- Click "Show Results in UI" to process

## Advanced: Manual extraction workflow

**For developers or batch processing only:**

The workbook can also be extracted and processed manually via scripts.

### Required location for manual processing

Place the workbook in:
- data/raw/blyon budget.xlsx

### Extract only the Actuals tab

Run:

powershell
./scripts/extract-actuals-tab.ps1 -WorkbookPath "./data/raw/blyon budget.xlsx" -SheetName "Actuals" -OutputCsv "data/processed/actuals-tab-export.csv

Expected output:
- data/processed/actuals-tab-export.csv

### After extraction

The next processing step will:
- Map columns from Actuals to the ExpenseEntry contract
- Validate amount and date fields
- Produce accepted and rejected row reports
