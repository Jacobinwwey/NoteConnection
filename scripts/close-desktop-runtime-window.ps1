param(
    [Parameter(Mandatory=$true)][int]$ApplicationProcessId,
    [Parameter(Mandatory=$true)][string]$ExecutablePath
)
$ErrorActionPreference = 'Stop'
$application = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $ApplicationProcessId)
if (-not $application -or $application.ExecutablePath -ne [System.IO.Path]::GetFullPath($ExecutablePath)) {
    throw 'The process is not the owned desktop runtime'
}
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DesktopRuntimeClose {
    public delegate bool EnumWindow(IntPtr hwnd, IntPtr param);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindow callback, IntPtr param);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int capacity);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr window, uint message, UIntPtr wParam, IntPtr lParam);
    public static bool Close(int owner) {
        bool posted = false;
        EnumWindows((window, ignored) => {
            uint pid; GetWindowThreadProcessId(window, out pid);
            if (pid != owner) return true;
            var title = new StringBuilder(512); GetWindowText(window, title, title.Capacity);
            if (title.ToString() != "NoteConnection") return true;
            posted = PostMessage(window, 0x0010, UIntPtr.Zero, IntPtr.Zero);
            return false;
        }, IntPtr.Zero);
        return posted;
    }
}
'@
if (-not [DesktopRuntimeClose]::Close($ApplicationProcessId)) { throw 'Unable to close the owned main window' }
@{ applicationProcessId=$ApplicationProcessId; closePosted=$true } | ConvertTo-Json -Depth 3
