$csvFile = "c:\dev\personal-budget-app\data\raw\Chase2674_Activity_20260816.csv"
$rows = Import-Csv $csvFile

# Simple vendor patterns
$patterns = @{
    "JPMORGAN CHASE" = "Mortgage"
    "GAINESVILLE REGIONAL UTILITIES" = "Water/electric"
    "CLIMATE FIRST" = "Climate First solar loan"
    "COX COMMUNICATIONS" = "Internet"
    "APPLE.COM" = "Internet"
    "PUBLIX" = "Groceries"
    "UPPERCRUST" = "Groceries"
    "CHUN CHING" = "Groceries"
    "LOWES" = "Home"
    "MILLHOPPER ACE" = "Home"
    "GEICO" = "Car insurance"
    "BOOST MOBILE" = "Phone"
}

$ytdActuals = @{}
$found = 0

foreach ($row in $rows) {
    if ($null -eq $row.'Post Date') { continue }
    
    $postDate = $row.'Post Date'.ToString().Trim()
    $desc = $row.Description.ToString().Trim()
    $amt_str = $row.Amount.ToString().Trim()
    
    # Filter for 2026, Jan-Aug only
    if ($postDate -notmatch '(0?[1-8])/(\d+)/2026') { continue }
    
    # Parse amount
    try {
        $amt = [decimal]($amt_str -replace '[\$,]', '')
        if ($amt -lt 0) { $amt = -$amt }
        if ($amt -ge 10000) { continue }
    } catch {
        continue
    }
    
    # Match vendor
    $found_cat = $null
    $desc_upper = $desc.ToUpper()
    
    foreach ($vendor in $patterns.Keys) {
        if ($desc_upper.Contains($vendor.ToUpper())) {
            $found_cat = $patterns[$vendor]
            break
        }
    }
    
    if ($found_cat) {
        $found++
        if (-not $ytdActuals.ContainsKey($found_cat)) {
            $ytdActuals[$found_cat] = 0
        }
        $ytdActuals[$found_cat] += $amt
    }
}

Write-Host "Found $found matched 2026 transactions from Chase2674"
Write-Host ""
Write-Host "YTD 2026 Actuals (Chase2674):"
Write-Host ""

foreach ($cat in ($ytdActuals.Keys | Sort-Object)) {
    $amt = $ytdActuals[$cat]
    $formatted = [string]::Format("{0:F2}", $amt)
    Write-Host "$cat : `$$formatted"
}
