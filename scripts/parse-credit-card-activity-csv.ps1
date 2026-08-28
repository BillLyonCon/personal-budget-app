param(
  [Parameter(Mandatory=$true)]
  [string[]]$InputCsvFiles,
  [string]$OutputTransactionsCsv = "data/processed/expenses/credit-cards/credit-card-transactions-from-csv.csv",
  [string]$OutputMonthlyCsv = "data/processed/expenses/credit-cards/credit-card-purchases-summary-from-csv.csv"
)

$ErrorActionPreference = "Stop"

function Get-CardAccountName {
  param([string]$FilePath)
  $name = (Split-Path -Leaf $FilePath).ToLowerInvariant()
  if ($name -match '6305') { return 'amazon-card' }
  if ($name -match '2674') { return 'day-to-day-card' }
  return 'unknown-card'
}

$txOut = @()

foreach ($file in $InputCsvFiles) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Input CSV not found: $file"
  }

  $cardAccount = Get-CardAccountName $file
  $rows = Import-Csv -LiteralPath $file

  foreach ($r in $rows) {
    $type = ("$($r.Type)").Trim()
    $amountRaw = ("$($r.Amount)").Trim()
    $postDateRaw = ("$($r.'Post Date')").Trim()
    $description = ("$($r.Description)").Trim()
    $category = ("$($r.Category)").Trim()

    $dt = $null
    try { $dt = [datetime]::Parse($postDateRaw, [System.Globalization.CultureInfo]::InvariantCulture) } catch { continue }

    $amount = 0.0
    if (-not [double]::TryParse(($amountRaw -replace ',', ''), [ref]$amount)) { continue }

    # Keep purchase-like transactions as observed card expenses.
    # CSV encodes sales as negative values.
    if ($type -eq 'Sale') {
      $expense = [math]::Round([math]::Abs($amount), 2)
      $txOut += [pscustomobject]@{
        transactionDate = $dt.ToString('yyyy-MM-dd')
        month = $dt.ToString('yyyy-MM')
        cardAccount = $cardAccount
        description = $description
        category = if ($category -eq '') { 'uncategorized' } else { $category }
        amount = $expense
        source = (Split-Path -Leaf $file)
      }
    }
  }
}

$outDir1 = Split-Path -Parent $OutputTransactionsCsv
$outDir2 = Split-Path -Parent $OutputMonthlyCsv
if ($outDir1 -and -not (Test-Path -LiteralPath $outDir1)) { New-Item -ItemType Directory -Path $outDir1 | Out-Null }
if ($outDir2 -and -not (Test-Path -LiteralPath $outDir2)) { New-Item -ItemType Directory -Path $outDir2 | Out-Null }

$txOut | Export-Csv -LiteralPath $OutputTransactionsCsv -NoTypeInformation

$monthly = $txOut |
  Group-Object month, cardAccount |
  ForEach-Object {
    $parts = $_.Name -split ',\s*'
    [pscustomobject]@{
      month = $parts[0]
      cardAccount = $parts[1]
      purchasesAmount = [math]::Round((($_.Group | Measure-Object -Property amount -Sum).Sum), 2)
      transactionCount = $_.Count
      source = 'credit-card-csv'
    }
  } |
  Sort-Object month, cardAccount

$monthly | Export-Csv -LiteralPath $OutputMonthlyCsv -NoTypeInformation

$total = [math]::Round((($txOut | Measure-Object -Property amount -Sum).Sum), 2)
Write-Output "Card transactions rows: $($txOut.Count) -> $OutputTransactionsCsv"
Write-Output "Card monthly rows: $($monthly.Count) -> $OutputMonthlyCsv"
Write-Output "Card purchases total: $total"
