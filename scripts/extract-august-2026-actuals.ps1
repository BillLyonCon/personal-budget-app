# Extract August 2026 actuals with proper CSV parsing

$budgetFile = "c:\dev\personal-budget-app\data\processed\vendor-category-mapping.csv"
$bankFile = "c:\dev\personal-budget-app\data\raw\Chase7442_Activity_20260816.csv"
$card1File = "c:\dev\personal-budget-app\data\raw\Chase2674_Activity_20260816.csv"
$card2File = "c:\dev\personal-budget-app\data\raw\Chase6305_Activity_20260816.csv"

# Parse budget CSV manually (col A=Category, col G=Vendors)
$vendorMap = @{}
$budgetLines = Get-Content $budgetFile -Encoding UTF8 | Where-Object { $_.Trim() }

for ($i = 1; $i -lt $budgetLines.Count; $i++) {
  $line = $budgetLines[$i]
  $parts = @()
  $current = ""
  $inQuotes = $false
  
  foreach ($char in $line.ToCharArray()) {
    if ($char -eq '"') { $inQuotes = -not $inQuotes }
    elseif ($char -eq ',' -and -not $inQuotes) { $parts += $current; $current = "" }
    else { $current += $char }
  }
  $parts += $current
  
  if ($parts.Count -lt 7) { continue }
  
  $category = $parts[0].Trim()
  $vendors = $parts[6].Trim()  # Column G (0-indexed, so index 6)
  
  if ([string]::IsNullOrWhiteSpace($category) -or [string]::IsNullOrWhiteSpace($vendors)) { continue }
  if ($category -eq "SUM") { break }
  
  # Split vendors by comma
  $vendorList = $vendors -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  foreach ($vendor in $vendorList) {
    $key = $vendor.ToLower().Trim()
    $vendorMap[$key] = $category
  }
}

Write-Host "Loaded $($vendorMap.Count) vendor patterns`n"
Write-Host "Sample vendors:"
$vendorMap.Keys | Select-Object -First 10 | ForEach-Object { Write-Host "  $_ => $($vendorMap[$_])" }

# Function to find category by merchant name
function FindCategory($merchant) {
  if ([string]::IsNullOrWhiteSpace($merchant)) { return $null }
  $normalized = $merchant.ToLower().Trim()
  
  # Try exact match first
  foreach ($key in $vendorMap.Keys) {
    if ($normalized -eq $key) { return $vendorMap[$key] }
  }
  
  # Try substring match
  foreach ($key in $vendorMap.Keys) {
    if ($normalized -match [regex]::Escape($key)) { return $vendorMap[$key] }
    if ($key -match [regex]::Escape($normalized)) { return $vendorMap[$key] }
  }
  
  return $null
}

$actuals = @{}

# Process bank account
Write-Host "`n=== CHASE7442 BANK ACCOUNT ==="
$bankRows = Import-Csv $bankFile
$augustBank = $bankRows | Where-Object { $_.'Posting Date' -ge '08/01/2026' -and $_.'Posting Date' -le '08/31/2026' }
Write-Host "Found $($augustBank.Count) August bank transactions"

foreach ($row in $augustBank) {
  $desc = $row.Description
  $amt = [math]::Abs([decimal]$row.Amount)
  $category = FindCategory $desc
  
  if ($category) {
    if (-not $actuals.ContainsKey($category)) { $actuals[$category] = 0 }
    $actuals[$category] += $amt
    Write-Host "  $($row.'Posting Date') | $category | $desc | `$$($amt.ToString('F2'))"
  }
}

# Process card 1
Write-Host "`n=== CHASE2674 CREDIT CARD ==="
$card1Rows = Import-Csv $card1File
$augustCard1 = $card1Rows | Where-Object { $_.'Post Date' -ge '08/01/2026' -and $_.'Post Date' -le '08/31/2026' }
Write-Host "Found $($augustCard1.Count) August card 1 transactions"

foreach ($row in $augustCard1) {
  $desc = $row.Description
  $amt = [math]::Abs([decimal]$row.Amount)
  
  if ($desc -match "Payment" -or $amt -eq 0) { continue }
  
  $category = FindCategory $desc
  if ($category) {
    if (-not $actuals.ContainsKey($category)) { $actuals[$category] = 0 }
    $actuals[$category] += $amt
    Write-Host "  $($row.'Post Date') | $category | $desc | `$$($amt.ToString('F2'))"
  }
}

# Process card 2
Write-Host "`n=== CHASE6305 CREDIT CARD ==="
$card2Rows = Import-Csv $card2File
$augustCard2 = $card2Rows | Where-Object { $_.'Post Date' -ge '08/01/2026' -and $_.'Post Date' -le '08/31/2026' }
Write-Host "Found $($augustCard2.Count) August card 2 transactions"

foreach ($row in $augustCard2) {
  $desc = $row.Description
  $amt = [math]::Abs([decimal]$row.Amount)
  
  if ($desc -match "Payment" -or $amt -eq 0) { continue }
  
  $category = FindCategory $desc
  if ($category) {
    if (-not $actuals.ContainsKey($category)) { $actuals[$category] = 0 }
    $actuals[$category] += $amt
    Write-Host "  $($row.'Post Date') | $category | $desc | `$$($amt.ToString('F2'))"
  }
}

# Output summary
Write-Host "`n=== AUGUST 2026 ACTUAL TOTALS BY CATEGORY ==="
$sorted = $actuals.GetEnumerator() | Sort-Object Value -Descending
foreach ($item in $sorted) {
  Write-Host "$($item.Name): `$$($item.Value.ToString('F2'))"
}

$total = ($actuals.Values | Measure-Object -Sum).Sum
Write-Host "`nGRAND TOTAL: `$$($total.ToString('F2'))"

# Output as JavaScript object for test-chart.html
Write-Host "`n=== JavaScript Object for test-chart.html ==="
Write-Host '"2026-08": {'
foreach ($item in $sorted) {
  $jsName = "`"$($item.Name)`""
  Write-Host "  $jsName`: $($item.Value.ToString('F2')),  // from matched transactions"
}
Write-Host "},"
