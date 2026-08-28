param(
  [Parameter(Mandatory=$true)]
  [string]$WorkbookPath,

  [string]$SheetName = "Actuals",

  [string]$OutputCsv = "data/processed/actuals-tab-export.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $WorkbookPath)) {
  throw "Workbook not found: $WorkbookPath"
}

$excel = $null
$workbook = $null
$worksheet = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $fullWorkbookPath = (Resolve-Path -LiteralPath $WorkbookPath).Path
  $fullOutputPath = Join-Path (Get-Location) $OutputCsv

  $outputDir = Split-Path -Parent $fullOutputPath
  if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
  }

  $workbook = $excel.Workbooks.Open($fullWorkbookPath)

  $worksheet = $null
  foreach ($ws in $workbook.Worksheets) {
    if ($ws.Name -ieq $SheetName) {
      $worksheet = $ws
      break
    }
  }

  if ($null -eq $worksheet) {
    $sheetNames = @()
    foreach ($ws in $workbook.Worksheets) { $sheetNames += $ws.Name }
    throw "Sheet '$SheetName' not found. Available sheets: $($sheetNames -join ', ')"
  }

  # Save worksheet to CSV in UTF-8 by copying into a temporary workbook.
  $worksheet.Copy()
  $tempWorkbook = $excel.ActiveWorkbook

  # xlCSVUTF8 = 62
  $xlCSVUTF8 = 62
  $tempWorkbook.SaveAs($fullOutputPath, $xlCSVUTF8)
  $tempWorkbook.Close($false)

  Write-Output "Export complete: $OutputCsv"
}
finally {
  if ($worksheet -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet) | Out-Null }
  if ($workbook -ne $null) {
    $workbook.Close($false)
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
  }
  if ($excel -ne $null) {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
  }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
