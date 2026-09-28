# Extract actual YTD 2026 (Jan-Aug) from all statements

$bankFile = "c:\dev\personal-budget-app\data\raw\Chase7442_Activity_20260816.csv"
$card1File = "c:\dev\personal-budget-app\data\raw\Chase2674_Activity_20260816.csv"
$card2File = "c:\dev\personal-budget-app\data\raw\Chase6305_Activity_20260816.csv"

# Simple vendor map (key entries only)
$vendorMap = @{
  "mortgage" = "Mortgage"
  "jpmorgan chase   chase ach" = "Mortgage"
  "water/electric" = "Water/electric"
  "gainesville regional utilities" = "Water/electric"
  "climate first" = "Climate First solar loan"
  "pool" = "Pool"
  "swim state" = "Pool"
  "groceries" = "Groceries"
  "publix" = "Groceries"
  "fresh market" = "Groceries"
  "northwest seafood" = "Groceries"
  "chun ching" = "Groceries"
  "uppercrust" = "Groceries"
  "food & drink" = "Food & Drink"
  "dragonfly" = "Food & Drink"
  "sushi" = "Food & Drink"
  "verde spice" = "Food & Drink"
  "brewery" = "Food & Drink"
  "liquors" = "Food & Drink"
  "gas" = "Gas"
  "marathon" = "Gas"
  "circle k" = "Gas"
  "car loan" = "Car loan payments"
  "florida credit union" = "Car loan payments"
  "insurance" = "Car insurance"
  "geico" = "Car insurance"
  "pest" = "Pest service"
  "arrow exterminators" = "Pest service"
  "home" = "Home"
  "lowes" = "Home"
  "millhopper" = "Home"
  "home depot" = "Home"
  "garden gate" = "Home"
  "elias" = "Elias"
  "weimark" = "Elias"
  "wise inc" = "Elias"
  "yak management" = "Elias"
  "phone" = "Phone"
  "boost mobile" = "Phone"
  "internet" = "Internet"
  "cox" = "Internet"
  "apple.com" = "Internet"
  "dental" = "Dental"
  "health" = "Health"
  "cvs" = "Health"
  "pharmacy" = "Health"
  "vet" = "Penny vet visits"
  "petdata" = "Penny vet visits"
  "suburban animal" = "Penny vet visits"
  "streaming" = "Streaming"
  "netflix" = "Streaming"
  "hbo" = "Streaming"
  "qobuz" = "Streaming"
  "meds" = "Penny meds"
  "dog tracker" = "Dog tracker"
  "tractive" = "Dog tracker"
  "elias phone" = "Elias phone"
  "amazon prime" = "Amazon Prime"
  "amazon prime membership" = "Amazon Prime"
}

function FindCategory($desc) {
  if ([string]::IsNullOrWhiteSpace($desc)) { return $null }
  $desc = $desc.ToLower().Trim()
  
  # Exact match first
  if ($vendorMap.ContainsKey($desc)) { return $vendorMap[$desc] }
  
  # Substring match
  foreach ($key in $vendorMap.Keys) {
    if ($desc -like "*$key*") { return $vendorMap[$key] }
  }
  return $null
}

$actuals = @{}

# Bank (Chase7442) - Jan-Aug 2026
Write-Host "Processing Chase7442 (Bank)..."
$bankRows = @(Import-Csv $bankFile)
$janAug = $bankRows | Where-Object { 
  try {
    $date = [datetime]::ParseExact($_.'Posting Date', 'MM/dd/yyyy', $null)
    $date.Year -eq 2026 -and $date.Month -ge 1 -and $date.Month -le 8
  } catch { $false }
}

Write-Host "Found $($janAug.Count) Jan-Aug 2026 bank transactions"
foreach ($row in $janAug) {
  $desc = $row.Description
  $amt = [math]::Abs([decimal]$row.Amount)
  $cat = FindCategory $desc
  if ($cat) {
    if (-not $actuals.ContainsKey($cat)) { $actuals[$cat] = 0 }
    $actuals[$cat] += $amt
  }
}

# Card 1 (Chase2674) - Jan-Aug 2026
Write-Host "Processing Chase2674 (Card)..."
$card1Rows = @(Import-Csv $card1File)
$janAugCard = $card1Rows | Where-Object { 
  try {
    $date = [datetime]::ParseExact($_.'Post Date', 'MM/dd/yyyy', $null)
    $date.Year -eq 2026 -and $date.Month -ge 1 -and $date.Month -le 8 -and $_.Description -notmatch "Payment"
  } catch { $false }
}

Write-Host "Found $($janAugCard.Count) Jan-Aug 2026 card transactions"
foreach ($row in $janAugCard) {
  $desc = $row.Description
  $amt = [math]::Abs([decimal]$row.Amount)
  if ($amt -gt 0) {
    $cat = FindCategory $desc
    if ($cat) {
      if (-not $actuals.ContainsKey($cat)) { $actuals[$cat] = 0 }
      $actuals[$cat] += $amt
    }
  }
}

# Card 2 (Chase6305) - Jan-Aug 2026
Write-Host "Processing Chase6305 (Card)..."
$card2Rows = @(Import-Csv $card2File)
$janAugCard2 = $card2Rows | Where-Object { 
  try {
    $date = [datetime]::ParseExact($_.'Post Date', 'MM/dd/yyyy', $null)
    $date.Year -eq 2026 -and $date.Month -ge 1 -and $date.Month -le 8 -and $_.Description -notmatch "Payment"
  } catch { $false }
}

Write-Host "Found $($janAugCard2.Count) Jan-Aug 2026 card2 transactions"
foreach ($row in $janAugCard2) {
  $desc = $row.Description
  $amt = [math]::Abs([decimal]$row.Amount)
  if ($amt -gt 0) {
    $cat = FindCategory $desc
    if ($cat) {
      if (-not $actuals.ContainsKey($cat)) { $actuals[$cat] = 0 }
      $actuals[$cat] += $amt
    }
  }
}

# Output results
Write-Host "`n=== YTD 2026 ACTUALS (Jan-Aug) ===" 
$total = 0
$sorted = $actuals.GetEnumerator() | Where-Object { $_.Value -gt 0 } | Sort-Object Value -Descending
foreach ($item in $sorted) {
  $roundedVal = [math]::Round($item.Value, 2)
  Write-Host "$($item.Name): $roundedVal"
  $total += $roundedVal
}
Write-Host "`nTOTAL: $total"

Write-Host "`n=== JavaScript Format ==="
Write-Host '"2026-YTD": {'
foreach ($item in $sorted) {
  $roundedVal = [math]::Round($item.Value, 2)
  Write-Host "  `"$($item.Name)`": $roundedVal,"
}
Write-Host "},"
