param(
  [Parameter(Mandatory=$true)]
  [string]$PdfPath,

  [string]$OutputPrefix = "income-statement"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $PdfPath)) {
  throw "PDF not found: $PdfPath"
}

$rawDir = "data/raw/income"
$processedDir = "data/processed/income"

if (-not (Test-Path -LiteralPath $rawDir)) {
  New-Item -ItemType Directory -Path $rawDir | Out-Null
}
if (-not (Test-Path -LiteralPath $processedDir)) {
  New-Item -ItemType Directory -Path $processedDir | Out-Null
}

$resolvedPdf = (Resolve-Path -LiteralPath $PdfPath).Path
$fileName = Split-Path -Leaf $resolvedPdf
$copyTarget = Join-Path $rawDir $fileName

if ($resolvedPdf -ne (Resolve-Path -LiteralPath $rawDir -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.Path $fileName })) {
  Copy-Item -LiteralPath $resolvedPdf -Destination $copyTarget -Force
}

$manifestPath = Join-Path $processedDir ($OutputPrefix + "-manifest.csv")

@(
  [pscustomobject]@{
    source_pdf = $copyTarget
    extracted_text_path = ""
    accepted_rows_path = ""
    rejected_rows_path = ""
    status = "queued_for_parsing"
    notes = "Awaiting parser tool selection (text parse vs OCR)"
  }
) | Export-Csv -LiteralPath $manifestPath -NoTypeInformation

Write-Output "PDF staged: $copyTarget"
Write-Output "Manifest created: $manifestPath"
Write-Output "Next: run selected PDF parser and populate accepted/rejected outputs in data/processed/income"
