# Wrapper so Claude never needs inline PowerShell. Usage:
#   .\run_checks.ps1 -Company "ABC Traders" -From 2025-04-01 -To 2026-03-31 -DayBook daybook.xlsx -Out E:\Client_Data\abc\_checks\2026-10-15
param(
    [Parameter(Mandatory)][string]$Company,
    [Parameter(Mandatory)][string]$DayBook,
    [Parameter(Mandatory)][string]$Out,
    [string]$From = "",
    [string]$To = "",
    [string]$Checks = "all"
)
$argsList = @("run_checks.py", "--company", $Company, "--daybook", $DayBook, "--out", $Out, "--checks", $Checks)
if ($From) { $argsList += @("--from", $From) }
if ($To)   { $argsList += @("--to", $To) }
python @argsList
exit $LASTEXITCODE
