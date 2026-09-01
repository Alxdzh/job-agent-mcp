param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ForwardArgs
)

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))

function Find-Node {
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @(
    (Join-Path ${env:ProgramFiles} 'nodejs\node.exe'),
    (Join-Path ${env:LOCALAPPDATA} 'Programs\nodejs\node.exe')
  )
  return $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

try {
  & (Join-Path $Root 'one-click-start.ps1') -InstallOnly
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  # The child PowerShell process can refresh PATH only for itself. Resolve the
  # normal installation locations again so a freshly installed Node is usable
  # without asking the user to reopen the shell.
  $node = Find-Node
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
