param(
    [string]$TitleContains = 'NoteConnection',
    [string]$OutputPath = '',
    [int]$MatchIndex = 0,
    [switch]$ActivateWindow
)

$ErrorActionPreference = 'Stop'

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
    return $Path
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = Ensure-Directory -Path (Join-Path $repoRoot 'output\window-debug')
$timestamp = Get-Date -Format 'yyyy-MM-ddTHH-mm-ss-fff'

if (-not $OutputPath) {
    $OutputPath = Join-Path $artifactRoot ("noteconnection-window-$timestamp.png")
}

$metadataPath = [System.IO.Path]::ChangeExtension($OutputPath, '.json')

Add-Type -ReferencedAssemblies System.Drawing, System.Windows.Forms -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class NoteConnectionWindowCapture {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public class WindowInfo {
        public IntPtr Handle;
        public int ProcessId;
        public string Title;
        public RECT Rect;
    }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out int processId);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public static List<WindowInfo> FindWindows(string titleContains) {
        var windows = new List<WindowInfo>();
        var needle = (titleContains ?? string.Empty).Trim();

        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) {
                return true;
            }

            var length = GetWindowTextLength(hWnd);
            if (length <= 0) {
                return true;
            }

            var builder = new StringBuilder(length + 1);
            GetWindowText(hWnd, builder, builder.Capacity);
            var title = builder.ToString();
            if (string.IsNullOrWhiteSpace(title)) {
                return true;
            }
            if (!string.IsNullOrEmpty(needle) && title.IndexOf(needle, StringComparison.OrdinalIgnoreCase) < 0) {
                return true;
            }

            RECT rect;
            if (!GetWindowRect(hWnd, out rect)) {
                return true;
            }

            int processId;
            GetWindowThreadProcessId(hWnd, out processId);

            windows.Add(new WindowInfo {
                Handle = hWnd,
                ProcessId = processId,
                Title = title,
                Rect = rect
            });
            return true;
        }, IntPtr.Zero);

        return windows;
    }
}
"@

$windows = [NoteConnectionWindowCapture]::FindWindows($TitleContains) |
    Where-Object { $_.Rect.Right -gt $_.Rect.Left -and $_.Rect.Bottom -gt $_.Rect.Top } |
    Sort-Object Title, ProcessId

if (-not $windows -or $windows.Count -eq 0) {
    throw "No visible window matched title filter: $TitleContains"
}

if ($MatchIndex -lt 0 -or $MatchIndex -ge $windows.Count) {
    throw "MatchIndex $MatchIndex is out of range. Matched windows: $($windows.Count)"
}

$targetWindow = $windows[$MatchIndex]
$left = [Math]::Max(0, [int]$targetWindow.Rect.Left)
$top = [Math]::Max(0, [int]$targetWindow.Rect.Top)
$width = [Math]::Max(1, [int]($targetWindow.Rect.Right - $targetWindow.Rect.Left))
$height = [Math]::Max(1, [int]($targetWindow.Rect.Bottom - $targetWindow.Rect.Top))

if ($ActivateWindow) {
    [NoteConnectionWindowCapture]::ShowWindow($targetWindow.Handle, 9) | Out-Null
    [NoteConnectionWindowCapture]::SetForegroundWindow($targetWindow.Handle) | Out-Null
    Start-Sleep -Milliseconds 250
}

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$usedPrintWindow = $false
try {
    $hdc = $graphics.GetHdc()
    try {
        $usedPrintWindow = [NoteConnectionWindowCapture]::PrintWindow($targetWindow.Handle, $hdc, 2)
        if (-not $usedPrintWindow) {
            $usedPrintWindow = [NoteConnectionWindowCapture]::PrintWindow($targetWindow.Handle, $hdc, 0)
        }
    } finally {
        $graphics.ReleaseHdc($hdc)
    }
    if (-not $usedPrintWindow) {
        $graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size)
    }
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
}

$processInfo = $null
try {
    $processInfo = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $targetWindow.ProcessId)
} catch {
    $processInfo = $null
}

$metadata = [ordered]@{
    success = $true
    titleFilter = $TitleContains
    matchIndex = $MatchIndex
    activateWindow = [bool]$ActivateWindow
    screenshotPath = $OutputPath
    capturedAt = (Get-Date).ToString('o')
    window = [ordered]@{
        title = $targetWindow.Title
        processId = $targetWindow.ProcessId
        left = $targetWindow.Rect.Left
        top = $targetWindow.Rect.Top
        right = $targetWindow.Rect.Right
        bottom = $targetWindow.Rect.Bottom
        width = $width
        height = $height
        usedPrintWindow = $usedPrintWindow
    }
    process = if ($processInfo) {
        [ordered]@{
            name = $processInfo.Name
            parentProcessId = $processInfo.ParentProcessId
            executablePath = $processInfo.ExecutablePath
            commandLine = $processInfo.CommandLine
        }
    } else {
        $null
    }
    matchedWindows = @(
        $windows | ForEach-Object {
            [ordered]@{
                title = $_.Title
                processId = $_.ProcessId
                left = $_.Rect.Left
                top = $_.Rect.Top
                right = $_.Rect.Right
                bottom = $_.Rect.Bottom
            }
        }
    )
}

$metadata | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $metadataPath -Encoding UTF8
$metadata | ConvertTo-Json -Depth 6
