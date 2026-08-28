param(
  [string]$InputTxt = "data/raw/expenses/bank-statements/zelle-payment-activity-paste.txt",
  [string]$OutputCsv = "data/processed/expenses/bank-statements/zelle-payment-activity-parsed.csv",
  [string]$OutputRejectedCsv = "data/processed/expenses/bank-statements/zelle-payment-activity-rejected.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputTxt)) {
  throw "Input text not found: $InputTxt"
}

function Normalize-Payee {
  param([string]$Value)
  $v = ($Value -replace '\s+', ' ').Trim()
  $v = $v -replace '^Monthly\s*', ''
  $v = $v -replace '^When\s+eBill\s+is\s+due\s*', ''
  return $v.Trim()
}

function Infer-Category {
  param([string]$Payee)
  $p = $Payee.ToLowerInvariant()
  if ($p -match 'fcu\s*car\s*loan') { return 'loan-payment' }
  if ($p -match 'cox\s*communications') { return 'internet' }
  if ($p -match '\bgru\b') { return 'utilities' }
  if ($p -match 'arrow\s*exterminators') { return 'pest-control' }
  if ($p -match 'pool\s*service|swim\s*state\s*pool') { return 'pool-service' }
  if ($p -match 'davis\s*gas') { return 'fuel-or-propane' }
  return 'zelle-pay-check-mailing'
}

$raw = (Get-Content -LiteralPath $InputTxt -Raw)
$flat = ($raw -replace '[\r\n\t]+', ' ' -replace '\s+', ' ').Trim()

$monthPattern = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec'
$pattern = ('(?<send>(?:{0})\s+\d{{1,2}},\s+\d{{4}})(?<deliver>(?:{0})\s+\d{{1,2}},\s+\d{{4}})(?<status>Pending|Processed|Paid)\s+(?<body>.+?)\$(?<amount>[0-9,]+\.[0-9]{{2}})See details' -f $monthPattern)

$matches = [regex]::Matches($flat, $pattern)

$accepted = @()
$rejected = @()

foreach ($m in $matches) {
  try {
    $sendRaw = $m.Groups['send'].Value.Trim()
    $deliverRaw = $m.Groups['deliver'].Value.Trim()
    $status = $m.Groups['status'].Value.Trim()
    $bodyRaw = $m.Groups['body'].Value.Trim()
    $amount = [double](($m.Groups['amount'].Value) -replace ',', '')

    $sendDate = [datetime]::ParseExact($sendRaw, 'MMM d, yyyy', [System.Globalization.CultureInfo]::InvariantCulture)
    $deliverDate = [datetime]::ParseExact($deliverRaw, 'MMM d, yyyy', [System.Globalization.CultureInfo]::InvariantCulture)

    $payee = Normalize-Payee $bodyRaw
    $category = Infer-Category $payee
    $includeObserved = if ($status -eq 'Pending') { 'false' } else { 'true' }

    $accepted += [pscustomobject]@{
      sendDate = $sendDate.ToString('yyyy-MM-dd')
      deliverDate = $deliverDate.ToString('yyyy-MM-dd')
      transactionDate = $deliverDate.ToString('yyyy-MM-dd')
      month = $deliverDate.ToString('yyyy-MM')
      status = $status
      payee = $payee
      amount = [math]::Round($amount, 2)
      category = $category
      account = 'chase-checking-zelle-pay'
      includeInObservedExpenses = $includeObserved
      source = 'web-paste-payment-activity'
    }
  }
  catch {
    $rejected += [pscustomobject]@{
      rawChunk = $m.Value
      reason = 'parse_error'
      detail = $_.Exception.Message
    }
  }
}

if ($matches.Count -eq 0) {
  $rejected += [pscustomobject]@{ rawChunk = 'NO_MATCHES'; reason = 'regex_no_matches'; detail = 'Could not match payment activity entries.' }
}

$outDir = Split-Path -Parent $OutputCsv
$rejDir = Split-Path -Parent $OutputRejectedCsv
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
if ($rejDir -and -not (Test-Path -LiteralPath $rejDir)) { New-Item -ItemType Directory -Path $rejDir | Out-Null }

$accepted | Export-Csv -LiteralPath $OutputCsv -NoTypeInformation
$rejected | Export-Csv -LiteralPath $OutputRejectedCsv -NoTypeInformation

$acceptedTotal = [math]::Round((($accepted | Measure-Object -Property amount -Sum).Sum), 2)
$pendingTotal = [math]::Round((($accepted | Where-Object { $_.includeInObservedExpenses -eq 'false' } | Measure-Object -Property amount -Sum).Sum), 2)
$observedTotal = [math]::Round((($accepted | Where-Object { $_.includeInObservedExpenses -eq 'true' } | Measure-Object -Property amount -Sum).Sum), 2)

Write-Output "Parsed rows: $($accepted.Count)"
Write-Output "Rejected rows: $($rejected.Count)"
Write-Output "Parsed total amount: $acceptedTotal"
Write-Output "Observed total (Processed/Paid): $observedTotal"
Write-Output "Pending total: $pendingTotal"
