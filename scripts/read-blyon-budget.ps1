param(
  [string]$WorkbookPath = "data/blyon budget.xlsx"
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
  $colCount = $usedRange.Columns.Count

  Write-Output "Sheet: $($worksheet.Name)"
  Write-Output "Dimensions: $colCount columns, $rowCount rows"
  Write-Output ""
  Write-Output "First 20 rows:`n"

  for ($i = 1; $i -le [Math]::Min(20, $rowCount); $i++) {
    $rowData = @()
    for ($j = 1; $j -le $colCount; $j++) {
      $cellValue = $worksheet.Cells($i, $j).Value2
      if ($null -eq $cellValue) { $cellValue = "" }
      $rowData += "$cellValue"
    }
    $output = $rowData -join " | "
    Write-Output "Row $i : $output"
  }

} finally {
  if ($workbook) { $workbook.Close($false) }
  if ($excel) { $excel.Quit() }
  if ($excel) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
}
