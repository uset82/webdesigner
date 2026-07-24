param(
  [int]$Port = 5179
)

$conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $conns) {
  Write-Host "Port $Port is already free."
  exit 0
}

$pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $pids) {
  if ($procId -le 4) { continue }
  $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
  Write-Host "Stopping PID $procId ($($p.ProcessName)) on port $Port"
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 400
$left = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($left) {
  Write-Error "Port $Port is still in use."
  exit 1
}
Write-Host "Port $Port is free."
