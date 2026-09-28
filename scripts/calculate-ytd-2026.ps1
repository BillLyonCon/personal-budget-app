# Calculate YTD 2026 actuals from CHASE statements
# Matches vendor patterns from budget CSV and aggregates by category

# Load budget CSV to get vendor patterns
$budgetPath = "c:\dev\personal-budget-app\data\processed\vendor-category-mapping.csv"

# Parse budget CSV - build vendor pattern to category map
$vendorToCat = @{}
$catToMonthlyBudget = @{}

$budgetRows = Import-Csv $budgetPath

foreach ($row in $budgetRows) {
    if ($null -eq $row.Category) { continue }
    
    $category = $row.Category.Trim()
    $monthlyStr = $row.'mo. '.Trim()
    $vendors = $row.VENDOR.Trim()
    
    if ([string]::IsNullOrWhiteSpace($category)) { continue }
    
    if (-not [string]::IsNullOrWhiteSpace($vendors)) {
        $vendors.Split(',') | ForEach-Object {
            $vendor = $_.Trim()
            if ($vendor -and $vendor -ne "") {
                $vendorToCat[$vendor] = $category
            }
        }
    }
    
    # Store monthly budget (parse number from string like "$2,200.00")
    if ($monthlyStr -match '(\d+)') {
        $amount = [decimal]($monthlyStr -replace '[\$,\s]', '')
        $catToMonthlyBudget[$category] = $amount
    }
}

Write-Host "Loaded $(($vendorToCat.Keys).Count) vendor patterns"
Write-Host ""

# Function to match vendor to category
function Find-Category {
    param([string]$description)
    
    $desc = $description.ToLower().Trim()
    
    # Try exact match first
    foreach ($vendor in $vendorToCat.Keys) {
        $v = $vendor.ToLower().Trim()
        if ($v -eq $desc) {
            return $vendorToCat[$vendor]
        }
    }
    
    # Try substring match
    foreach ($vendor in $vendorToCat.Keys) {
        $v = $vendor.ToLower().Trim()
        if ($desc.Contains($v)) {
            return $vendorToCat[$vendor]
        }
    }
    
    return $null
}

# Parse all three CHASE statements
$csvFiles = @(
    "c:\dev\personal-budget-app\data\raw\Chase2674_Activity_20260816.csv",
    "c:\dev\personal-budget-app\data\raw\Chase6305_Activity_20260816.csv",
    "c:\dev\personal-budget-app\data\raw\Chase7442_Activity_20260816.csv"
)

$ytdActuals = @{}
$transactionCount = 0
$matchedCount = 0

foreach ($csvFile in $csvFiles) {
    if (-not (Test-Path $csvFile)) {
        Write-Host "File not found: $csvFile"
        continue
    }
    
    Write-Host "Reading $([System.IO.Path]::GetFileName($csvFile))..."
    
    try {
        $rows = Import-Csv $csvFile -ErrorAction Stop
    } catch {
        Write-Host "Error reading $csvFile : $_"
        continue
    }
    
    foreach ($row in $rows) {
        # Check for null values
        if ($null -eq $row -or $null -eq $row.'Post Date' -or $null -eq $row.Description) {
            continue
        }
        
        $postDate = $row.'Post Date'.ToString().Trim()
        $description = $row.Description.ToString().Trim()
        $amountStr = if ($row.Amount) { $row.Amount.ToString().Trim() } else { "" }
        
        if ([string]::IsNullOrWhiteSpace($postDate) -or [string]::IsNullOrWhiteSpace($description)) {
            continue
        }
        
        # Parse post date - only include 2026
        if ($postDate -match '(\d+)/(\d+)/(\d+)') {
            $month = [int]$matches[1]
            $year = [int]$matches[3]
            
            # Only 2026 (Jan-Aug)
            if ($year -ne 2026 -or $month -lt 1 -or $month -gt 8) {
                continue
            }
        } else {
            continue
        }
        
        $transactionCount++
        
        # Parse amount
        if ([string]::IsNullOrWhiteSpace($amountStr)) { continue }
        
        try {
            $amt = [decimal]($amountStr -replace '[\$,]', '')
            if ($amt -lt 0) { $amt = -$amt }  # Make positive
        } catch {
            continue
        }
        
        # Skip very large outliers
        if ($amt -ge 10000) {
            continue
        }
        
        # Match to category
        $cat = Find-Category $description
        
        if ($cat) {
            $matchedCount++
            if (-not $ytdActuals.ContainsKey($cat)) {
                $ytdActuals[$cat] = 0
            }
            $ytdActuals[$cat] += $amt
        }
    }
}

Write-Host "Processed $transactionCount transactions, matched $matchedCount"
Write-Host ""

# Calculate YTD budget (8 months: Jan-Aug)
$ytdBudget = @{}
foreach ($cat in $catToMonthlyBudget.Keys) {
    $ytdBudget[$cat] = $catToMonthlyBudget[$cat] * 8
}

# Output YTD results
Write-Host "YTD 2026 Budget vs Actual:"
Write-Host ""

$totalBudget = 0
$totalActual = 0

$allCategories = @($ytdBudget.Keys) + @($ytdActuals.Keys) | Sort-Object -Unique

foreach ($cat in $allCategories) {
    $budget = if ($ytdBudget.ContainsKey($cat)) { $ytdBudget[$cat] } else { 0 }
    $actual = if ($ytdActuals.ContainsKey($cat)) { [math]::Round($ytdActuals[$cat], 2) } else { 0 }
    
    $totalBudget += $budget
    $totalActual += $actual
    $variance = $budget - $actual
    
    if ($budget -gt 0 -or $actual -gt 0) {
        Write-Host ("{0,-35} Budget: ${1,10:F2}  Actual: ${2,10:F2}  Var: ${3,10:F2}" -f $cat, $budget, $actual, $variance)
    }
}

Write-Host ""
Write-Host ("{0,-35} Budget: ${1,10:F2}  Actual: ${2,10:F2}  Var: ${3,10:F2}" -f "TOTAL", $totalBudget, $totalActual, ($totalBudget - $totalActual))
