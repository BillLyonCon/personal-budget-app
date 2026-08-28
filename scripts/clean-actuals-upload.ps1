param(
  [string]$InputCsv = "data/processed/actuals-tab-export.csv",
  [string]$OutputCleanCsv = "data/processed/actuals-clean-upload.csv",
  [string]$OutputRejectedCsv = "data/processed/actuals-rejected-rows.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputCsv)) {
  throw "Input CSV not found: $InputCsv"
}

function Parse-Money {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }

  $clean = ($Value -replace '[^0-9\.-]', '').Trim()
  if ([string]::IsNullOrWhiteSpace($clean)) { return $null }

  $out = 0.0
  if ([double]::TryParse($clean, [ref]$out)) {
    return [math]::Round($out, 2)
  }

  throw "Invalid money value: '$Value'"
}

$allowedBasis = @('FIXED', 'ESTIMATED', 'CALCULATED')
$noiseNames = @('SUM', 'FIDELITY FEES', 'ALLEN')

$headers = 'name','monthly','daily','quarterly','yearly','basis','notes'
$rawRows = Get-Content -LiteralPath $InputCsv | ConvertFrom-Csv -Header $headers

$accepted = @()
$rejected = @()

for ($i = 0; $i -lt $rawRows.Count; $i++) {
  $lineNo = $i + 1
  $row = $rawRows[$i]

  # Skip extracted header row from source sheet.
  if ($lineNo -eq 1) { continue }

  $name = ($row.name | ForEach-Object { "$_" }).Trim()
  $basis = ($row.basis | ForEach-Object { "$_" }).Trim().ToUpperInvariant()
  $notes = ($row.notes | ForEach-Object { "$_" }).Trim()

  if ([string]::IsNullOrWhiteSpace($name)) {
    $rejected += [pscustomobject]@{ line = $lineNo; name = $name; reason = 'empty_name' }
    continue
  }

  if ($noiseNames -contains $name.ToUpperInvariant()) {
    $rejected += [pscustomobject]@{ line = $lineNo; name = $name; reason = 'noise_row' }
    continue
  }

  try {
    $monthly = Parse-Money $row.monthly
    $daily = Parse-Money $row.daily
    $quarterly = Parse-Money $row.quarterly
    $yearly = Parse-Money $row.yearly
  }
  catch {
    $rejected += [pscustomobject]@{ line = $lineNo; name = $name; reason = 'invalid_amount_format'; detail = $_.Exception.Message }
    continue
  }

  if ($null -eq $monthly -and $null -eq $daily -and $null -eq $quarterly -and $null -eq $yearly) {
    $rejected += [pscustomobject]@{ line = $lineNo; name = $name; reason = 'no_amount_values' }
    continue
  }

  if ([string]::IsNullOrWhiteSpace($basis) -or -not ($allowedBasis -contains $basis)) {
    $rejected += [pscustomobject]@{ line = $lineNo; name = $name; reason = 'invalid_basis'; detail = "basis must be FIXED, ESTIMATED, or CALCULATED" }
    continue
  }

  $monthlyNormalized = $null
  $normalizationRule = $null

  if ($monthly -ne $null) {
    $monthlyNormalized = $monthly
    $normalizationRule = 'monthly_source'
  }
  elseif ($quarterly -ne $null) {
    $monthlyNormalized = [math]::Round(($quarterly / 3.0), 2)
    $normalizationRule = 'quarterly_div_3'
  }
  elseif ($yearly -ne $null) {
    $monthlyNormalized = [math]::Round(($yearly / 12.0), 2)
    $normalizationRule = 'yearly_div_12'
  }
  elseif ($daily -ne $null) {
    $monthlyNormalized = [math]::Round(($daily * 30.0), 2)
    $normalizationRule = 'daily_mul_30'
  }

  $accepted += [pscustomobject]@{
    line = $lineNo
    item = $name
    monthly_amount = $monthly
    daily_amount = $daily
    quarterly_amount = $quarterly
    yearly_amount = $yearly
    monthly_normalized = $monthlyNormalized
    basis = $basis
    notes = $notes
    normalization_rule = $normalizationRule
  }
}

$outputCleanDir = Split-Path -Parent $OutputCleanCsv
$outputRejectedDir = Split-Path -Parent $OutputRejectedCsv

if ($outputCleanDir -and -not (Test-Path -LiteralPath $outputCleanDir)) {
  New-Item -ItemType Directory -Path $outputCleanDir | Out-Null
}
if ($outputRejectedDir -and -not (Test-Path -LiteralPath $outputRejectedDir)) {
  New-Item -ItemType Directory -Path $outputRejectedDir | Out-Null
}

$accepted | Export-Csv -LiteralPath $OutputCleanCsv -NoTypeInformation
$rejected | Export-Csv -LiteralPath $OutputRejectedCsv -NoTypeInformation

$totalRows = $rawRows.Count - 1
$acceptedRows = $accepted.Count
$rejectedRows = $rejected.Count
$sumMonthlyNormalized = [math]::Round((($accepted | Measure-Object -Property monthly_normalized -Sum).Sum), 2)

Write-Output "Cleaned upload CSV: $OutputCleanCsv"
Write-Output "Rejected rows CSV: $OutputRejectedCsv"
Write-Output "Total source rows (excluding header row): $totalRows"
Write-Output "Accepted rows: $acceptedRows"
Write-Output "Rejected rows: $rejectedRows"
Write-Output "Monthly normalized total (accepted): $sumMonthlyNormalized"
