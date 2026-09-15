param(
    [Parameter(Mandatory=$true)][string]$ExecutablePath,
    [Parameter(Mandatory=$true)][string]$ReportDirectory,
    [Parameter(Mandatory=$true)][string]$NodeExecutablePath
)
$ErrorActionPreference = 'Stop'

if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
    throw 'WebView2 machine policy qualification requires a disposable GitHub-hosted runner'
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'The elevated-runtime qualifier requires an elevated runner'
}
$workspacePrefix = [IO.Path]::GetFullPath($env:GITHUB_WORKSPACE).TrimEnd('\') + '\'
$executable = [IO.Path]::GetFullPath($ExecutablePath)
$reportRoot = [IO.Path]::GetFullPath($ReportDirectory)
foreach ($target in @($executable, $reportRoot)) {
    if (-not $target.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Desktop qualification paths must stay inside the runner workspace'
    }
}
if (-not (Test-Path -LiteralPath $executable -PathType Leaf) -or (Test-Path -LiteralPath $reportRoot)) {
    throw 'Expected an existing executable and a fresh evidence directory'
}
if (-not (Test-Path -LiteralPath $NodeExecutablePath -PathType Leaf)) { throw 'Node executable is missing' }

$debugPort = 0
for ($attempt = 0; $attempt -lt 64; $attempt++) {
    $candidate = Get-Random -Minimum 49152 -Maximum 65536
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidate)
    try { $listener.Start(); $debugPort = $candidate; break }
    catch [Net.Sockets.SocketException] {
        if ($_.Exception.SocketErrorCode -notin @([Net.Sockets.SocketError]::AddressAlreadyInUse, [Net.Sockets.SocketError]::AccessDenied)) { throw }
    }
    finally { $listener.Stop() }
}
if ($debugPort -eq 0) { throw 'No browser-compatible debugger port is available' }

# WebView2 150+ ignores environment/HKCU switch overrides in elevated hosts.
# Use its supported machine-policy channel only for this disposable test app.
# https://github.com/MicrosoftEdge/WebView2Feedback/issues/5640#issuecomment-4923662109
$policyPath = 'HKLM:\Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments'
$policyNames = @('com.jacobinwwey.noteconnection', 'npm.exe')
$browserArguments = "--remote-debugging-port=$debugPort --remote-allow-origins=http://127.0.0.1:$debugPort"
if (Test-Path -LiteralPath $policyPath) {
    $existing = Get-ItemProperty -LiteralPath $policyPath
    foreach ($name in $policyNames) {
        if ($existing.PSObject.Properties.Name -contains $name) { throw "Refusing to replace an existing WebView2 policy for $name" }
    }
}
$writtenNames = @()
$previousDebugPort = $env:NOTE_CONNECTION_DESKTOP_DEBUG_PORT
$nodeExitCode = 1
try {
    if (-not (Test-Path -LiteralPath $policyPath)) { New-Item -Path $policyPath -Force | Out-Null }
    foreach ($name in $policyNames) {
        New-ItemProperty -LiteralPath $policyPath -Name $name -PropertyType String -Value $browserArguments | Out-Null
        $writtenNames += $name
    }
    $env:NOTE_CONNECTION_DESKTOP_DEBUG_PORT = [string]$debugPort
    & $NodeExecutablePath (Join-Path $PSScriptRoot 'verify-desktop-runtime.js') $executable $reportRoot
    $nodeExitCode = $LASTEXITCODE
}
finally {
    [Environment]::SetEnvironmentVariable('NOTE_CONNECTION_DESKTOP_DEBUG_PORT', $previousDebugPort, 'Process')
    foreach ($name in $writtenNames) {
        $current = Get-ItemPropertyValue -LiteralPath $policyPath -Name $name
        if ($current -ne $browserArguments) { throw "WebView2 policy ownership changed for $name; refusing to remove it" }
        Remove-ItemProperty -LiteralPath $policyPath -Name $name
    }
    if (Test-Path -LiteralPath $reportRoot -PathType Container) {
        [ordered]@{
            channel = 'HKLM WebView2 AdditionalBrowserArguments'
            applicationPolicyNames = $policyNames
            debuggerPort = $debugPort
            elevated = $true
            policyValuesRemoved = $true
            runtimeExitCode = $nodeExitCode
        } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $reportRoot 'native-debug-policy.json') -Encoding UTF8
    }
}
exit $nodeExitCode
