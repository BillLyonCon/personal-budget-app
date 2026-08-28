param(
  [string]$InputTxt = "data/processed/income/20260625-statements-7442- (1).txt",
  [string]$OutputAcceptedCsv = "data/processed/income/income-transactions-accepted.csv",
  [string]$OutputRejectedCsv = "data/processed/income/income-transactions-rejected.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputTxt)) {
  throw "Input text file not found: $InputTxt"
}

$text = Get-Content -LiteralPath $InputTxt -Raw
$lines = $text -split "`r?`n"

$periodMatch = [regex]::Match($text, '([A-Za-z]+\s+\d{1,2},\s+(\d{4}))\s+through\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})')
$year = if ($periodMatch.Success) { [int]$periodMatch.Groups[2].Value } else { (Get-Date).Year }

$inDeposits = $false
$accepted = @()
$rejected = @()

foreach ($line in $lines) {
  $trim = $line.Trim()

  if ($trim -eq 'DEPOSITS AND ADDITIONS') {
    $inDeposits = $true
    continue
  }

  if ($inDeposits -and $trim -match '^Total Deposits and Additions') {
    $inDeposits = $false
    continue
  }

  if (-not $inDeposits) { continue }

  # Expected format: MM/DD Description ... Amount
  $m = [regex]::Match($trim, '^(\d{2})\/(\d{2})\s+(.+?)\s+\$?([0-9,]+\.\d{2})$')
  if (-not $m.Success) {
    if ($trim -ne '' -and $trim -ne 'DATE DESCRIPTION AMOUNT') {
      $rejected += [pscustomobject]@{ line = $trim; reason = 'unparsed_deposit_line' }
    }
    continue
  }

  $mm = [int]$m.Groups[1].Value
  $dd = [int]$m.Groups[2].Value
  $desc = $m.Groups[3].Value.Trim()
  $amt = [double](($m.Groups[4].Value) -replace ',', '')

  $date = [datetime]::new($year, $mm, $dd).ToString('yyyy-MM-dd')

  $source = 'other-income'
  if ($desc -match '(?i)microsoft') { $source = 'microsoft' }
  elseif ($desc -match '(?i)soc\s*sec|ssa\s*treas') { $source = 'social-security' }
  elseif ($desc -match '(?i)interest\s+payment') { $source = 'interest' }

  $accepted += [pscustomobject]@{
    transactionDate = $date
    source = $source
    description = $desc
    amount = [math]::Round($amt, 2)
    isIncome = 'true'
    sourceStatement = (Split-Path -Leaf $InputTxt)
  }
}

$outDir1 = Split-Path -Parent $OutputAcceptedCsv
$outDir2 = Split-Path -Parent $OutputRejectedCsv
if ($outDir1 -and -not (Test-Path -LiteralPath $outDir1)) { New-Item -ItemType Directory -Path $outDir1 | Out-Null }
if ($outDir2 -and -not (Test-Path -LiteralPath $outDir2)) { New-Item -ItemType Directory -Path $outDir2 | Out-Null }

$accepted | Export-Csv -LiteralPath $OutputAcceptedCsv -NoTypeInformation
$rejected | Export-Csv -LiteralPath $OutputRejectedCsv -NoTypeInformation

$sum = [math]::Round((($accepted | Measure-Object -Property amount -Sum).Sum), 2)
Write-Output "Income accepted rows: $($accepted.Count)"
Write-Output "Income rejected rows: $($rejected.Count)"
Write-Output "Income total: $sum"
