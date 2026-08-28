# Upload Template Layout

Use this layout for budget-line uploads so parser validation is deterministic and noise rows are excluded.

## File type

- CSV or XLS/XLSX worksheet named Actuals
- One header row only
- No summary rows inside data region (no SUM, percentages, or footer notes)

## Required columns

- item
- basis

## Amount columns (at least one required per row)

- monthly_amount
- daily_amount
- quarterly_amount
- yearly_amount

## Optional columns

- notes

## Month handling

- No month column is required in the upload template.
- This template represents stable recurring monthly baselines.
- Month is injected only when materializing contract-ready import files for a specific cycle.

## Allowed basis values

- FIXED
- ESTIMATED
- CALCULATED

## Credit card rollup handling

- If a line is a credit-card rollup placeholder (for example amazon), it is deferred during contract export.
- Deferred rows are written to data/processed/credit-card-rollup-deferred.csv.
- Deferred rows are tagged by card account:
  - amazon-card
  - day-to-day-card
- These rows should be replaced by detailed credit-card statement imports categorized into:
  - food
  - restaurants
  - entertainment
  - gas
  - materials-clothing

## Row validation rules

- item must be non-empty
- basis must be one of allowed values
- at least one amount value must parse as a number
- parser computes monthly_normalized in this order:
  - monthly_amount
  - quarterly_amount / 3
  - yearly_amount / 12
  - daily_amount * 30

## Template file

- data/raw/actuals-upload-template.csv

## Current converter for your sheet

To convert the exported Actuals sheet into this clean format:

powershell
./scripts/clean-actuals-upload.ps1 -InputCsv "data/processed/actuals-tab-export.csv" -OutputCleanCsv "data/processed/actuals-clean-upload.csv" -OutputRejectedCsv "data/processed/actuals-rejected-rows.csv"

To generate contract imports and automatically defer card-rollup placeholders:

powershell
./scripts/materialize-contract-imports.ps1 -InputCleanCsv "data/processed/actuals-clean-upload.csv"
