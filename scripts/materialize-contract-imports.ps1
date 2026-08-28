param(
  [string]$InputCleanCsv = "data/processed/actuals-clean-upload.csv",
  [string]$Month = "",
  [string]$ObligationsOut = "data/processed/obligation-entry-import.csv",
  [string]$CategoriesOut = "data/processed/budget-category-import.csv",
  [string]$DeferredRollupsOut = "data/processed/credit-card-rollup-deferred.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputCleanCsv)) {
  throw "Input clean CSV not found: $InputCleanCsv"
}

if ([string]::IsNullOrWhiteSpace($Month)) {
  $Month = (Get-Date).ToString('yyyy-MM')
}

if ($Month -notmatch '^\d{4}-\d{2}$') {
  throw "Month must be YYYY-MM format. Received: $Month"
}

function To-Slug {
  param([string]$Text)
  $s = $Text.ToLowerInvariant().Trim()
  $s = $s -replace '[^a-z0-9]+', '-'
  $s = $s.Trim('-')
  if ([string]::IsNullOrWhiteSpace($s)) { $s = 'item' }
  return $s
}

function Infer-ObligationType {
  param([string]$Name)
  $n = $Name.ToLowerInvariant()
  if ($n -match 'mort') { return 'mortgage' }
  if ($n -match 'loan') { return 'loan' }
  return 'other-fixed'
}

function Is-CreditCardRollupItem {
  param([string]$Name)
  $n = $Name.ToLowerInvariant()
  return (
    $n -match 'amazon' -or
    $n -match 'credit\s*card' -or
    $n -match 'visa' -or
    $n -match 'master\s*card|mastercard' -or
    $n -match 'amex|american\s*express' -or
    $n -match 'discover'
  )
}

function Infer-CreditCardAccount {
  param([string]$Name)
  $n = $Name.ToLowerInvariant()
  if ($n -match 'amazon') { return 'amazon-card' }
  return 'day-to-day-card'
}

$rows = Import-Csv -LiteralPath $InputCleanCsv

$obligations = @()
$categories = @()
$deferredRollups = @()

foreach ($r in $rows) {
  $name = ($r.item | ForEach-Object { "$_" }).Trim()
  $basis = ($r.basis | ForEach-Object { "$_" }).Trim().ToUpperInvariant()
  $notes = ($r.notes | ForEach-Object { "$_" }).Trim()
  $monthly = [double]$r.monthly_normalized
  $idBase = To-Slug $name

  if (Is-CreditCardRollupItem $name) {
    $cardAccount = Infer-CreditCardAccount $name
    $deferredRollups += [pscustomobject]@{
      id = "cc-rollup-$idBase"
      month = $Month
      cardAccount = $cardAccount
      name = $name
      amount = [math]::Round($monthly, 2)
      basis = $basis
      notes = $notes
      reason = 'deferred_to_credit_card_statement_categories'
      target_categories = 'food|restaurants|entertainment|gas|materials-clothing'
    }
    continue
  }

  if ($basis -eq 'FIXED') {
    $obligations += [pscustomobject]@{
      id = "obl-$idBase"
      month = $Month
      type = Infer-ObligationType $name
      name = $name
      amount = [math]::Round($monthly, 2)
      dueDay = 1
      notes = $notes
    }
  }
  else {
    $categories += [pscustomobject]@{
      id = "cat-$idBase"
      month = $Month
      name = $name
      budgetAmount = [math]::Round($monthly, 2)
      notes = $notes
      basis = $basis
    }
  }
}

$oblDir = Split-Path -Parent $ObligationsOut
$catDir = Split-Path -Parent $CategoriesOut
$deferredDir = Split-Path -Parent $DeferredRollupsOut
if ($oblDir -and -not (Test-Path -LiteralPath $oblDir)) { New-Item -ItemType Directory -Path $oblDir | Out-Null }
if ($catDir -and -not (Test-Path -LiteralPath $catDir)) { New-Item -ItemType Directory -Path $catDir | Out-Null }
if ($deferredDir -and -not (Test-Path -LiteralPath $deferredDir)) { New-Item -ItemType Directory -Path $deferredDir | Out-Null }

$obligations | Export-Csv -LiteralPath $ObligationsOut -NoTypeInformation
$categories | Export-Csv -LiteralPath $CategoriesOut -NoTypeInformation
$deferredRollups | Export-Csv -LiteralPath $DeferredRollupsOut -NoTypeInformation

Write-Output "Month used: $Month"
Write-Output "Obligation rows: $($obligations.Count) -> $ObligationsOut"
Write-Output "Category rows: $($categories.Count) -> $CategoriesOut"
Write-Output "Deferred rollup rows: $($deferredRollups.Count) -> $DeferredRollupsOut"
