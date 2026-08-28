param(
  [string]$IncomeCsv = "data/processed/income/income-transactions-accepted.csv",
  [string]$IncomeCsv2 = "data/processed/income/income-transactions-from-csv.csv",
  [string]$BackfillIncomeCsv = "data/raw/income/monthly-income-backfill.csv",
  [string]$CardSummaryCsv = "data/processed/expenses/credit-cards/credit-card-purchases-summary.csv",
  [string]$CardSummaryCsv2 = "data/processed/expenses/credit-cards/credit-card-purchases-summary-from-csv.csv",
  [string]$BankExpensesCsv = "data/processed/expenses/bank-statements/zelle-payment-activity-parsed.csv",
  [string]$BankExpensesCsv2 = "data/processed/expenses/bank-statements/bank-expenses-from-csv.csv",
  [string]$BaselineObligationsCsv = "data/processed/obligation-entry-import.csv",
  [string]$BaselineCategoriesCsv = "data/processed/budget-category-import.csv",
  [string]$OutputCsv = "data/processed/income-vs-expense-snapshot.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $IncomeCsv) -and -not (Test-Path -LiteralPath $IncomeCsv2)) {
  throw "At least one income CSV is required: $IncomeCsv or $IncomeCsv2"
}
if (-not (Test-Path -LiteralPath $CardSummaryCsv) -and -not (Test-Path -LiteralPath $CardSummaryCsv2)) {
  throw "At least one card summary CSV is required: $CardSummaryCsv or $CardSummaryCsv2"
}
if (-not (Test-Path -LiteralPath $BaselineObligationsCsv)) { throw "Obligations CSV missing: $BaselineObligationsCsv" }
if (-not (Test-Path -LiteralPath $BaselineCategoriesCsv)) { throw "Categories CSV missing: $BaselineCategoriesCsv" }

$income = @()
if (Test-Path -LiteralPath $IncomeCsv) {
  $income += Import-Csv -LiteralPath $IncomeCsv
}
if (Test-Path -LiteralPath $IncomeCsv2) {
  $income += Import-Csv -LiteralPath $IncomeCsv2
}
$cards = @()
if (Test-Path -LiteralPath $CardSummaryCsv2) {
  # Prefer CSV-derived card data when present.
  $cards = Import-Csv -LiteralPath $CardSummaryCsv2
}
elseif (Test-Path -LiteralPath $CardSummaryCsv) {
  $cards = Import-Csv -LiteralPath $CardSummaryCsv
}
$bank = @()
if (Test-Path -LiteralPath $BankExpensesCsv2) {
  # Prefer CSV-derived bank expenses when present.
  $bank = Import-Csv -LiteralPath $BankExpensesCsv2
}
elseif (Test-Path -LiteralPath $BankExpensesCsv) {
  # Web-paste parser is fallback only when CSV-derived bank expenses are absent.
  $bank = Import-Csv -LiteralPath $BankExpensesCsv
}
$obl = Import-Csv -LiteralPath $BaselineObligationsCsv
$cat = Import-Csv -LiteralPath $BaselineCategoriesCsv

$baselineObl = [math]::Round((($obl | Measure-Object -Property amount -Sum).Sum), 2)
$baselineCat = [math]::Round((($cat | Measure-Object -Property budgetAmount -Sum).Sum), 2)
$baselineTotal = [math]::Round($baselineObl + $baselineCat, 2)

$incomeByMonth = @{}
foreach ($r in $income) {
  $month = ([datetime]$r.transactionDate).ToString('yyyy-MM')
  if (-not $incomeByMonth.ContainsKey($month)) { $incomeByMonth[$month] = 0.0 }
  $incomeByMonth[$month] += [double]$r.amount
}

$backfillByMonth = @{}
if (Test-Path -LiteralPath $BackfillIncomeCsv) {
  $backfillRows = Import-Csv -LiteralPath $BackfillIncomeCsv
  foreach ($r in $backfillRows) {
    if ([string]::IsNullOrWhiteSpace($r.month)) { continue }
    if ($r.month -notmatch '^\d{4}-\d{2}$') { continue }

    $value = 0.0
    if (-not [string]::IsNullOrWhiteSpace($r.backfillIncome)) {
      [void][double]::TryParse(($r.backfillIncome -replace ',', ''), [ref]$value)
    }

    if (-not $backfillByMonth.ContainsKey($r.month)) { $backfillByMonth[$r.month] = 0.0 }
    $backfillByMonth[$r.month] += $value
  }
}

$cardsByMonth = @{}
foreach ($r in $cards) {
  $month = $r.month
  if (-not $cardsByMonth.ContainsKey($month)) { $cardsByMonth[$month] = 0.0 }
  $cardsByMonth[$month] += [double]$r.purchasesAmount
}

$bankByMonth = @{}
foreach ($r in $bank) {
  if ($r.includeInObservedExpenses -ne 'true') { continue }
  $month = $r.month
  if (-not $bankByMonth.ContainsKey($month)) { $bankByMonth[$month] = 0.0 }
  $bankByMonth[$month] += [double]$r.amount
}

$months = @($incomeByMonth.Keys + $backfillByMonth.Keys + $cardsByMonth.Keys + $bankByMonth.Keys | Sort-Object -Unique)
$outRows = @()
foreach ($m in $months) {
  $incObserved = if ($incomeByMonth.ContainsKey($m)) { [math]::Round($incomeByMonth[$m], 2) } else { 0.0 }
  $incBackfill = if ($backfillByMonth.ContainsKey($m)) { [math]::Round($backfillByMonth[$m], 2) } else { 0.0 }
  $inc = [math]::Round($incObserved + $incBackfill, 2)
  $card = if ($cardsByMonth.ContainsKey($m)) { [math]::Round($cardsByMonth[$m], 2) } else { 0.0 }
  $bankExpense = if ($bankByMonth.ContainsKey($m)) { [math]::Round($bankByMonth[$m], 2) } else { 0.0 }
  $knownExpense = [math]::Round($baselineTotal + $card + $bankExpense, 2)
  $net = [math]::Round($inc - $knownExpense, 2)

  $outRows += [pscustomobject]@{
    month = $m
    incomeObserved = $incObserved
    incomeBackfill = $incBackfill
    incomeTotalForMonth = $inc
    baselineExpenses = $baselineTotal
    cardPurchasesObserved = $card
    bankExpensesObserved = $bankExpense
    knownExpensesTotal = $knownExpense
    netObservedMinusKnownExpenses = $net
  }
}

$outDir = Split-Path -Parent $OutputCsv
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$outRows | Export-Csv -LiteralPath $OutputCsv -NoTypeInformation
Write-Output "Snapshot rows: $($outRows.Count)"
Write-Output "Output: $OutputCsv"
