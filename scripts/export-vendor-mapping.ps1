param(
  [string]$WorkbookPath = "data/blyon budget.xlsx",
  [string]$OutputCsv = "data/processed/vendor-category-mapping.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $WorkbookPath)) {
  throw "File not found: $WorkbookPath"
}

$excel = $null
$workbook = $null
$worksheet = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $fullPath = (Resolve-Path -LiteralPath $WorkbookPath).Path
  $workbook = $excel.Workbooks.Open($fullPath)

  $worksheet = $workbook.Worksheets(1)
  $usedRange = $worksheet.UsedRange
  $rowCount = $usedRange.Rows.Count

  # Extract columns A (Category), G (Vendors), H (Chase Category)
  $mappings = @()

  for ($i = 2; $i -le $rowCount; $i++) {
    $category = $worksheet.Cells($i, 1).Value2
    $vendors = $worksheet.Cells($i, 7).Value2
    $chaseCategory = $worksheet.Cells($i, 8).Value2

    # Skip empty rows
    if ([string]::IsNullOrWhiteSpace($category)) { continue }

    $mappings += [pscustomobject]@{
      budgetCategory = "$category"
      vendorPatterns = "$vendors"
      chaseCategory = "$chaseCategory"
    }
  }

  # Ensure output directory exists
  $outputDir = Split-Path -Parent $OutputCsv
  if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
  }

  # Export to CSV
  $mappings | Export-Csv -LiteralPath $OutputCsv -NoTypeInformation -Encoding UTF8

  Write-Output "Extracted $($mappings.Count) vendor mapping rows"
  Write-Output "Output: $OutputCsv"
  Write-Output ""
  Write-Output "Sample rows:"
  $mappings | Select-Object -First 5 | Format-Table

} finally {
  if ($workbook) { $workbook.Close($false) }
  if ($excel) { $excel.Quit() }
  if ($excel) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
}
