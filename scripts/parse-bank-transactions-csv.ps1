param(
  [Parameter(Mandatory=$true)]
  [string]$InputCsv,
  [string]$IncomeOutCsv = "data/processed/income/income-transactions-from-csv.csv",
  [string]$BankExpenseOutCsv = "data/processed/expenses/bank-statements/bank-expenses-from-csv.csv",
  [string]$RejectedOutCsv = "data/processed/expenses/bank-statements/bank-transactions-csv-rejected.csv",
  [string]$AccountLabel = "chase-checking",
  [switch]$TreatAllCreditsAsIncome
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputCsv)) {
  throw "Input CSV not found: $InputCsv"
}

function Get-ColumnName {
  param(
    [object[]]$Columns,
    [string[]]$Candidates
  )

  foreach ($c in $Candidates) {
    $hit = $Columns | Where-Object { $_.ToLowerInvariant() -eq $c.ToLowerInvariant() } | Select-Object -First 1
    if ($hit) { return $hit }
  }

  return $null
}

function Parse-Money {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }

  $v = $Value.Trim()
  $isParenNegative = ($v.StartsWith('(') -and $v.EndsWith(')'))
  $v = $v -replace '[\$,]', ''
  $v = $v -replace '[()]', ''
  $v = $v.Trim()

  if ($v -eq '') { return $null }

  $out = 0.0
  if (-not [double]::TryParse($v, [ref]$out)) {
    return $null
  }

  if ($isParenNegative) { $out = -1 * $out }
  return [math]::Round($out, 2)
}

function Parse-DateSafe {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }

  $formats = @('MM/dd/yyyy','M/d/yyyy','yyyy-MM-dd','MM-dd-yyyy','M-d-yyyy')
  foreach ($fmt in $formats) {
    try {
      return [datetime]::ParseExact($Value.Trim(), $fmt, [System.Globalization.CultureInfo]::InvariantCulture)
    }
    catch {}
  }

  try {
    return [datetime]::Parse($Value.Trim(), [System.Globalization.CultureInfo]::InvariantCulture)
  }
  catch {
    return $null
  }
}

function Infer-IncomeSource {
  param([string]$Description)

  $d = ($Description | ForEach-Object { "$_" }).ToLowerInvariant()
  if ($d -match 'microsoft') { return 'microsoft' }
  if ($d -match 'ssa|soc\s*sec|treas\s*310') { return 'social-security' }
  if ($d -match 'interest') { return 'interest' }
  return 'deposit-other'
}

function Infer-ExpenseCategory {
  param([string]$Description)

  $d = ($Description | ForEach-Object { "$_" }).ToLowerInvariant()
  if ($d -match 'fcu\s*car\s*loan|car\s*loan') { return 'loan-payment' }
  if ($d -match 'cox\s*communications') { return 'internet' }
  if ($d -match '\bgru\b|utilities') { return 'utilities' }
  if ($d -match 'arrow\s*exterminators') { return 'pest-control' }
  if ($d -match 'pool\s*service|swim\s*state\s*pool') { return 'pool-service' }
  if ($d -match 'davis\s*gas|gas') { return 'fuel-or-propane' }
  return 'bank-expense-other'
}

$rows = Import-Csv -LiteralPath $InputCsv
if ($rows.Count -eq 0) {
  throw "CSV has no data rows: $InputCsv"
}

$columns = @($rows[0].PSObject.Properties.Name)
$dateCol = Get-ColumnName -Columns $columns -Candidates @('Posting Date','Transaction Date','Date','Post Date')
$descCol = Get-ColumnName -Columns $columns -Candidates @('Description','Details','Memo','Payee','Transaction Description')
$statusCol = Get-ColumnName -Columns $columns -Candidates @('Status','State')

$amountCol = Get-ColumnName -Columns $columns -Candidates @('Amount','Transaction Amount')
$debitCol = Get-ColumnName -Columns $columns -Candidates @('Debit','Withdrawal','Withdrawals')
$creditCol = Get-ColumnName -Columns $columns -Candidates @('Credit','Deposit','Deposits')

if (-not $dateCol) { throw "Could not detect a date column in: $InputCsv" }
if (-not $descCol) { throw "Could not detect a description column in: $InputCsv" }
if (-not $amountCol -and -not ($debitCol -or $creditCol)) {
  throw "Could not detect amount/debit/credit columns in: $InputCsv"
}

$income = @()
$bankExpenses = @()
$rejected = @()

$lineNo = 1
foreach ($r in $rows) {
  $lineNo++

  $dateRaw = "$($r.$dateCol)"
  $descRaw = "$($r.$descCol)"
  $statusRaw = if ($statusCol) { "$($r.$statusCol)" } else { '' }

  $dt = Parse-DateSafe $dateRaw
  if ($null -eq $dt) {
    $rejected += [pscustomobject]@{ line = $lineNo; reason = 'invalid_date'; detail = $dateRaw }
    continue
  }

  if ([string]::IsNullOrWhiteSpace($descRaw)) {
    $rejected += [pscustomobject]@{ line = $lineNo; reason = 'empty_description'; detail = '' }
    continue
  }

  $amount = $null
  if ($amountCol) {
    $amount = Parse-Money "$($r.$amountCol)"
  }

  if ($null -eq $amount) {
    $credit = if ($creditCol) { Parse-Money "$($r.$creditCol)" } else { $null }
    $debit = if ($debitCol) { Parse-Money "$($r.$debitCol)" } else { $null }

    $c = if ($null -eq $credit) { 0.0 } else { [double]$credit }
    $d = if ($null -eq $debit) { 0.0 } else { [double]$debit }
    $amount = [math]::Round($c - $d, 2)
  }

  if ($null -eq $amount -or $amount -eq 0.0) {
    $rejected += [pscustomobject]@{ line = $lineNo; reason = 'invalid_or_zero_amount'; detail = "$($r.$amountCol)" }
    continue
  }

  $statusNorm = $statusRaw.Trim()
  $includeObserved = if ($statusNorm -match '^(?i)pending$') { 'false' } else { 'true' }

  if ($amount -gt 0) {
    $isLikelyIncome = $TreatAllCreditsAsIncome.IsPresent -or ($descRaw -match '(?i)microsoft|ssa|soc\s*sec|treas\s*310|interest|deposit|payroll')
    if ($isLikelyIncome) {
      $income += [pscustomobject]@{
        transactionDate = $dt.ToString('yyyy-MM-dd')
        source = Infer-IncomeSource $descRaw
        description = $descRaw.Trim()
        amount = [math]::Round($amount, 2)
        isIncome = 'true'
        sourceStatement = (Split-Path -Leaf $InputCsv)
      }
    }
  }
  else {
    $bankExpenses += [pscustomobject]@{
      transactionDate = $dt.ToString('yyyy-MM-dd')
      month = $dt.ToString('yyyy-MM')
      status = if ($statusNorm -eq '') { 'Processed' } else { $statusNorm }
      payee = $descRaw.Trim()
      amount = [math]::Round([math]::Abs($amount), 2)
      category = Infer-ExpenseCategory $descRaw
      account = $AccountLabel
      includeInObservedExpenses = $includeObserved
      source = 'bank-transaction-csv'
    }
  }
}

foreach ($path in @($IncomeOutCsv, $BankExpenseOutCsv, $RejectedOutCsv)) {
  $dir = Split-Path -Parent $path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
}

$income | Export-Csv -LiteralPath $IncomeOutCsv -NoTypeInformation
$bankExpenses | Export-Csv -LiteralPath $BankExpenseOutCsv -NoTypeInformation
$rejected | Export-Csv -LiteralPath $RejectedOutCsv -NoTypeInformation

$incomeTotal = [math]::Round((($income | Measure-Object -Property amount -Sum).Sum), 2)
$expenseTotal = [math]::Round((($bankExpenses | Measure-Object -Property amount -Sum).Sum), 2)

Write-Output "Income rows: $($income.Count) -> $IncomeOutCsv"
Write-Output "Income total: $incomeTotal"
Write-Output "Bank expense rows: $($bankExpenses.Count) -> $BankExpenseOutCsv"
Write-Output "Bank expense total: $expenseTotal"
Write-Output "Rejected rows: $($rejected.Count) -> $RejectedOutCsv"
