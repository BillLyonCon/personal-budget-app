param(
  [Parameter(Mandatory=$true)]
  [string]$PdfPath,

  [string]$OutputPrefix = "credit-card-statement"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $PdfPath)) {
  throw "PDF not found: $PdfPath"
}

$rawDir = "data/raw/expenses/credit-cards"
$processedDir = "data/processed/expenses/credit-cards"

if (-not (Test-Path -LiteralPath $rawDir)) {
  New-Item -ItemType Directory -Path $rawDir | Out-Null
}
if (-not (Test-Path -LiteralPath $processedDir)) {
  New-Item -ItemType Directory -Path $processedDir | Out-Null
}

$resolvedPdf = (Resolve-Path -LiteralPath $PdfPath).Path
$fileName = Split-Path -Leaf $resolvedPdf
$copyTarget = Join-Path $rawDir $fileName

if ($resolvedPdf -ne (Resolve-Path -LiteralPath $copyTarget -ErrorAction SilentlyContinue | ForEach-Object { $_.Path })) {
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
    notes = "Awaiting credit-card parser execution"
  }
) | Export-Csv -LiteralPath $manifestPath -NoTypeInformation

Write-Output "PDF staged: $copyTarget"
Write-Output "Manifest created: $manifestPath"
Write-Output "Next: parse statement lines and map categories in data/processed/expenses/credit-cards"
