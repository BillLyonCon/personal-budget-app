param(
  [string]$InputCsv = "data/processed/actuals-tab-export.csv",
  [string]$OutputCleanCsv = "data/processed/actuals-clean.csv",
  [string]$OutputRejectedCsv = "data/processed/actuals-rejected.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputCsv)) {
  throw "Input CSV not found: $InputCsv"
}

function Parse-Currency {
  param([string]$Value)

  if ($null -eq $Value) { return $null }
  $v = $Value.Trim()
  if ([string]::IsNullOrWhiteSpace($v)) { return $null }

  $v = $v -replace '\$', ''
  $v = $v -replace ',', ''
  $v = $v -replace '"', ''
  $v = $v.Trim()

  $num = 0.0
  if ([double]::TryParse($v, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$num)) {
    return [Math]::Round($num, 2)
  }

  return $null
}

$rawLines = Get-Content -LiteralPath $InputCsv
if ($rawLines.Count -lt 2) {
  throw "Input CSV does not contain data rows: $InputCsv"
}

$dataLines = $rawLines | Select-Object -Skip 1
$parsed = $dataLines | ConvertFrom-Csv -Header @('item','monthly','daily','quarterly','yearly','status','notes')

$accepted = New-Object System.Collections.Generic.List[object]
$rejected = New-Object System.Collections.Generic.List[object]

$rowNumber = 1
foreach ($r in $parsed) {
  $rowNumber++

  $item = if ($null -ne $r.item) { $r.item.Trim() } else { "" }
  $monthly = Parse-Currency $r.monthly
  $daily = Parse-Currency $r.daily
  $quarterly = Parse-Currency $r.quarterly
  $yearly = Parse-Currency $r.yearly
  $status = if ($null -ne $r.status) { $r.status.Trim().ToUpperInvariant() } else { "" }
  $notes = if ($null -ne $r.notes) { $r.notes.Trim() } else { "" }

  if ([string]::IsNullOrWhiteSpace($item) -and $null -eq $monthly -and $null -eq $yearly) {
    continue
  }

  if ($item.ToUpperInvariant() -eq 'SUM') {
    $rejected.Add([pscustomobject]@{
      rowIndex = $rowNumber
      item = $item
      reason = 'summary row'
    }) | Out-Null
    continue
  }

  if ($item.ToUpperInvariant() -eq 'FIDELITY FEES' -or $item.ToUpperInvariant() -eq 'ALLEN') {
    $rejected.Add([pscustomobject]@{
      rowIndex = $rowNumber
      item = $item
      reason = 'non-budget footer row'
    }) | Out-Null
    continue
  }

  if ($null -eq $monthly) {
    if ($null -ne $quarterly) {
      $monthly = [Math]::Round($quarterly / 3, 2)
    } elseif ($null -ne $yearly) {
      $monthly = [Math]::Round($yearly / 12, 2)
    }
  }

  if ($null -eq $yearly -and $null -ne $monthly) {
    $yearly = [Math]::Round($monthly * 12, 2)
  }

  if ([string]::IsNullOrWhiteSpace($item)) {
    $rejected.Add([pscustomobject]@{
      rowIndex = $rowNumber
      item = $item
      reason = 'missing item name'
    }) | Out-Null
    continue
  }

  if ($null -eq $monthly -or $monthly -le 0) {
    $rejected.Add([pscustomobject]@{
      rowIndex = $rowNumber
      item = $item
      reason = 'missing or non-positive monthly amount'
    }) | Out-Null
    continue
  }

  if ([string]::IsNullOrWhiteSpace($status)) {
    $status = 'UNSPECIFIED'
  }

  $accepted.Add([pscustomobject]@{
    item = $item
    monthlyAmount = ('{0:N2}' -f $monthly)
    dailyAmount = if ($null -ne $daily) { ('{0:N2}' -f $daily) } else { '' }
    quarterlyAmount = if ($null -ne $quarterly) { ('{0:N2}' -f $quarterly) } else { '' }
    yearlyAmount = if ($null -ne $yearly) { ('{0:N2}' -f $yearly) } else { '' }
    status = $status
    notes = $notes
  }) | Out-Null
}

$cleanDir = Split-Path -Parent $OutputCleanCsv
if ($cleanDir -and -not (Test-Path -LiteralPath $cleanDir)) {
  New-Item -ItemType Directory -Path $cleanDir | Out-Null
}

$rejectedDir = Split-Path -Parent $OutputRejectedCsv
if ($rejectedDir -and -not (Test-Path -LiteralPath $rejectedDir)) {
  New-Item -ItemType Directory -Path $rejectedDir | Out-Null
}

$accepted | Export-Csv -LiteralPath $OutputCleanCsv -NoTypeInformation
$rejected | Export-Csv -LiteralPath $OutputRejectedCsv -NoTypeInformation

$acceptedMonthly = 0.0
foreach ($a in $accepted) {
  $v = 0.0
  [void][double]::TryParse(($a.monthlyAmount -replace ',', ''), [ref]$v)
  $acceptedMonthly += $v
}

[pscustomobject]@{
  input = $InputCsv
  acceptedRows = $accepted.Count
  rejectedRows = $rejected.Count
  acceptedMonthlyTotal = [Math]::Round($acceptedMonthly, 2)
  outputCleanCsv = $OutputCleanCsv
  outputRejectedCsv = $OutputRejectedCsv
} | Format-List | Out-String | Write-Output
