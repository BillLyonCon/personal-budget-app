$budgetPath = "c:\dev\personal-budget-app\data\processed\vendor-category-mapping.csv"
$budgetRows = Import-Csv $budgetPath

# Build complete vendor map from budget CSV
$vendorToCat = @{}
$catToMonthlyBudget = @{}

foreach ($row in $budgetRows) {
    if ($null -eq $row.Category) { continue }
    
    $category = $row.Category.Trim()
    $monthlyStr = $row.'mo. '.Trim()
    $vendors = $row.VENDOR.Trim()
    
    if ([string]::IsNullOrWhiteSpace($category)) { continue }
    
    # Parse vendors
    if ($vendors) {
        $vendors.Split(',') | ForEach-Object {
            $v = $_.Trim()
            if ($v) {
                $vendorToCat[$v] = $category
            }
        }
    }
    
    # Parse monthly budget
    if ($monthlyStr -match '[\d.]+') {
        $amt = [decimal]($monthlyStr -replace '[\$,\s]', '')
        $catToMonthlyBudget[$category] = $amt
    }
}

Write-Host "Loaded $(($vendorToCat.Keys).Count) vendor patterns and $($catToMonthlyBudget.Keys.Count) categories"
Write-Host ""

# Function to find category
function Find-Category {
    param([string]$description)
    
    $desc_upper = $description.ToUpper().Trim()
    
    # Exact match first
    foreach ($vendor in $vendorToCat.Keys) {
        $v_upper = $vendor.ToUpper().Trim()
        if ($v_upper -eq $desc_upper) {
            return $vendorToCat[$vendor]
        }
    }
    
    # Substring match
    foreach ($vendor in $vendorToCat.Keys) {
        $v_upper = $vendor.ToUpper().Trim()
        if ($desc_upper.Contains($v_upper)) {
            return $vendorToCat[$vendor]
        }
    }
    
    return $null
}

# Process all CHASE CSVs
$csvFiles = @(
    "c:\dev\personal-budget-app\data\raw\Chase2674_Activity_20260816.csv",
    "c:\dev\personal-budget-app\data\raw\Chase6305_Activity_20260816.csv",
    "c:\dev\personal-budget-app\data\raw\Chase7442_Activity_20260816.csv"
)

$ytdActuals = @{}
$totalProcessed = 0
$totalMatched = 0

foreach ($csvFile in $csvFiles) {
    if (-not (Test-Path $csvFile)) {
        continue
    }
    
    $filename = [System.IO.Path]::GetFileName($csvFile)
    Write-Host "Processing $filename..."
    
    $rows = Import-Csv $csvFile
    $processed = 0
    $matched = 0
    
    foreach ($row in $rows) {
        if ($null -eq $row.'Post Date') { continue }
        
        $postDate = $row.'Post Date'.ToString().Trim()
        $desc = $row.Description.ToString().Trim()
        $amt_str = $row.Amount.ToString().Trim()
        
        # Filter for 2026, Jan-Aug
        if ($postDate -notmatch '(0?[1-8])/(\d+)/2026') { continue }
        
        $processed++
        $totalProcessed++
        
        # Parse amount
        try {
            $amt = [decimal]($amt_str -replace '[\$,]', '')
            if ($amt -lt 0) { $amt = -$amt }
            if ($amt -ge 10000) { continue }
        } catch {
            continue
        }
        
        # Find category
        $cat = Find-Category $desc
        
        if ($cat) {
            $matched++
            $totalMatched++
            if (-not $ytdActuals.ContainsKey($cat)) {
                $ytdActuals[$cat] = 0
            }
            $ytdActuals[$cat] += $amt
        }
    }
    
    Write-Host "  Processed: $processed, Matched: $matched"
}

Write-Host ""
Write-Host "Total: Processed $totalProcessed, Matched $totalMatched"
Write-Host ""
Write-Host "================== YTD 2026 Budget vs Actual =================="
Write-Host ""

# Calculate YTD budget (8 months)
$ytdBudget = @{}
foreach ($cat in $catToMonthlyBudget.Keys) {
    $ytdBudget[$cat] = $catToMonthlyBudget[$cat] * 8
}

# Display results
$totalBudgetYTD = 0
$totalActualYTD = 0

$allCats = @($ytdBudget.Keys) + @($ytdActuals.Keys) | Sort-Object -Unique

foreach ($cat in $allCats) {
    $b = if ($ytdBudget.ContainsKey($cat)) { $ytdBudget[$cat] } else { 0 }
    $a = if ($ytdActuals.ContainsKey($cat)) { [math]::Round($ytdActuals[$cat], 2) } else { 0 }
    
    $totalBudgetYTD += $b
    $totalActualYTD += $a
    
    if ($b -gt 0 -or $a -gt 0) {
        $var = $b - $a
        $pct = if ($b -gt 0) { [math]::Round(($a / $b * 100), 1) } else { 0 }
        $line = "{0,-35} B: `${1,10:F2}  A: `${2,10:F2}  V: `${3,10:F2}  ({4,6}%)" -f $cat, $b, $a, $var, $pct
        Write-Host $line
    }
}

Write-Host ""
$var_total = $totalBudgetYTD - $totalActualYTD
$pct_total = if ($totalBudgetYTD -gt 0) { [math]::Round(($totalActualYTD / $totalBudgetYTD * 100), 1) } else { 0 }
$line_total = "{0,-35} B: `${1,10:F2}  A: `${2,10:F2}  V: `${3,10:F2}  ({4,6}%)" -f "TOTAL", $totalBudgetYTD, $totalActualYTD, $var_total, $pct_total
Write-Host $line_total
Write-Host ""
Write-Host "=============================================================="
