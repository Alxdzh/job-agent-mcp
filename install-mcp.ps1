param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ForwardArgs
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

try {
  & (Join-Path $Root 'one-click-start.ps1') -InstallOnly
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
  if (!$node) { throw 'Node.js was installed but node.exe is not available. Run install-mcp.bat again.' }
  $nodeArgs = @((Join-Path $Root 'tools\install-mcp.mjs'), '--skip-deps') + @($ForwardArgs)
  & $node @nodeArgs
  $exitCode = $LASTEXITCODE
  if ($null -eq $exitCode) { $exitCode = 0 }
  exit $exitCode
} catch {
  Write-Host "`n[Job Agent] MCP installation failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
