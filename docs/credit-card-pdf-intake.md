# Credit Card PDF Intake

Credit card statements are expense sources, not income.

## Primary workflow: Upload via web UI

**Recommended approach:**
- Open the Personal Budget app in your browser
- Go to the **Import Pipeline** tab
- Use the file upload fields to select your credit card CSV or PDF
- Click "Show Results in UI" to process

## Advanced: Manual folder-based processing

**For developers or batch workflows only:**

- Incoming statements: data/raw/expenses/credit-cards
- Parsed outputs: data/processed/expenses/credit-cards

## Naming convention

- amazon-card-YYYY-MM.pdf
- day-to-day-card-YYYY-MM.pdf
- If a statement spans multiple months, use a range:
	- amazon-card-YYYY-MM_to_YYYY-MM.pdf
	- day-to-day-card-YYYY-MM_to_YYYY-MM.pdf

## Parsing goal

Extract statement line items and map to spending categories such as:
- food
- restaurants
- entertainment
- gas
- materials-clothing

## Multi-month handling

- A single statement may include transactions from multiple calendar months.
- Do not force one month for the full PDF.
- Derive month from each transaction date (YYYY-MM) during normalization.
- Export one consolidated parsed file plus per-month files for downstream import.

## Integration rule

- Replace deferred credit-card rollup placeholders from data/processed/credit-card-rollup-deferred.csv with parsed statement category totals to avoid double counting.

## Notes

- Prefer Accessible PDF exports when available.
- Keep raw PDFs and extraction artifacts for auditability.
