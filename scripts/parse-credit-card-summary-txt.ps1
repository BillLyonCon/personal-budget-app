param(
  [string]$InputDir = "data/processed/expenses/credit-cards",
  [string]$OutputCsv = "data/processed/expenses/credit-cards/credit-card-purchases-summary.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputDir)) {
  throw "Input directory not found: $InputDir"
}

$rows = @()
$files = Get-ChildItem -LiteralPath $InputDir -File -Filter *.txt

foreach ($f in $files) {
  $text = Get-Content -LiteralPath $f.FullName -Raw

  $acctMatch = [regex]::Match($text, 'Account Number:\s+X+\s+X+\s+X+\s+(\d{4})')
  $end = if ($acctMatch.Success) { $acctMatch.Groups[1].Value } else { 'unknown' }

  $cardAccount = 'day-to-day-card'
  if ($end -eq '6305') { $cardAccount = 'amazon-card' }
  elseif ($end -eq '2674') { $cardAccount = 'day-to-day-card' }

  $dateMatch = [regex]::Match($text, 'Opening\/Closing Date\s+(\d{2})\/(\d{2})\/(\d{2})\s+-\s+(\d{2})\/(\d{2})\/(\d{2})')
  if (-not $dateMatch.Success) { continue }

  $closeYear = 2000 + [int]$dateMatch.Groups[6].Value
  $closeMonth = [int]$dateMatch.Groups[4].Value
  $closeDay = [int]$dateMatch.Groups[5].Value
  $closeDate = [datetime]::new($closeYear, $closeMonth, $closeDay)
  $month = $closeDate.ToString('yyyy-MM')

  $purchasesMatch = [regex]::Match($text, '(?m)^Purchases\s+\+\$([0-9,]+\.\d{2})$')
  if (-not $purchasesMatch.Success) { continue }

  $purchases = [double](($purchasesMatch.Groups[1].Value) -replace ',', '')

  $rows += [pscustomobject]@{
    month = $month
    closingDate = $closeDate.ToString('yyyy-MM-dd')
    cardAccount = $cardAccount
    accountEnding = $end
    purchasesAmount = [math]::Round($purchases, 2)
    sourceStatement = $f.Name
  }
}

$outDir = Split-Path -Parent $OutputCsv
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$rows | Export-Csv -LiteralPath $OutputCsv -NoTypeInformation

$total = [math]::Round((($rows | Measure-Object -Property purchasesAmount -Sum).Sum), 2)
Write-Output "Credit card summary rows: $($rows.Count)"
Write-Output "Credit card purchases total: $total"
