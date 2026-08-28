# Simple session commit script
# Usage: .\commit-session.ps1 "description of what you did"

param(
    [string]$Message = ""
)

# Get current date
$date = Get-Date -Format "yyyy-MM-dd"

# If no message provided, prompt for one
if (-not $Message) {
    Write-Host "Enter a brief description of what you did this session:"
    $Message = Read-Host "Message"
    
    if (-not $Message) {
        Write-Host "No message provided. Aborting."
        exit 1
    }
}

# Full commit message
$commitMsg = "Session $date : $Message"

Write-Host ""
Write-Host "Staging changes..."
git add -A

Write-Host "Creating commit: '$commitMsg'"
git commit -m $commitMsg

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Commit successful!"
    Write-Host ""
    Write-Host "Recent commits:"
    git log --oneline -5
} else {
    Write-Host "Commit failed or no changes to commit."
}
