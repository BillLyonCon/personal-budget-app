# Income PDF Intake

## Primary workflow: Upload via web UI

**Recommended approach:**
- Open the Personal Budget app in your browser
- Go to the **Import Pipeline** tab
- Use the file upload field for "1. Bank statement CSV (income + expenses)" to select your income statement or bank account activity
- Click "Show Results in UI" to process

## Repo decision

This repository is used for PDF income intake.

Reason:
- Data contracts, budget pipeline, and session logging are already here.
- Keeping one pipeline reduces handoff complexity.
- We can split to a private ingestion repo later if security or scale requires it.

## Advanced: Manual folder-based processing

**For developers or batch workflows only:**

- Incoming statements: data/raw/income
- Parsed outputs: data/processed/income

Important:
- This workflow is for income statements only.
- Credit card statements are expense inputs and should go to data/raw/expenses/credit-cards.

## PDF parsing expectations

- Accessible PDF is preferred when available.
- Accessible PDFs usually contain selectable/tagged text, which improves extraction accuracy and reduces manual cleanup.
- Text-based PDFs: high-confidence parsing is usually possible.
- Scanned/image PDFs: OCR is required and error rate is higher.

## Preferred statement export format

Priority order:
1. Accessible PDF
2. Standard text-based PDF
3. Scanned/image PDF (OCR fallback)

## Suggested processing stages

1. Intake
- Save PDF in data/raw/income.
- Use naming format: bank-account-YYYY-MM.pdf.

2. Extract
- Extract raw text tables from PDF (prefer tagged text paths for Accessible PDF).
- Keep raw extraction artifacts for audit.

3. Normalize
- Map extracted rows to an income staging schema.
- Normalize dates and amounts.

4. Validate
- Reject rows missing date, description/source, or amount.
- Output accepted and rejected reports.

5. Materialize contracts
- Create IncomeEntry contract-ready files with month injected when needed.

## Security notes

- Do not store credentials in code or scripts.
- Use export/download files from portal where possible.
- Keep raw statements in this local repo only.
