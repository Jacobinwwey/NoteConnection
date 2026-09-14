param([Parameter(Mandatory=$true)][int]$ApplicationProcessId)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class DesktopRuntimeWindows {
    public delegate bool EnumWindow(IntPtr hwnd, IntPtr param);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindow callback, IntPtr param);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder title, int count);
    public static object[] Snapshot(int[] owners) {
        var rows = new List<object>();
        EnumWindows((hwnd, ignored) => {
            uint pid; GetWindowThreadProcessId(hwnd, out pid);
            if (Array.IndexOf(owners, (int)pid) < 0) return true;
            var title = new StringBuilder(512); GetWindowText(hwnd, title, title.Capacity);
            if (title.ToString().StartsWith("NoteConnection"))
                rows.Add(new { processId=(int)pid, handle=hwnd.ToInt64(), title=title.ToString(), visible=IsWindowVisible(hwnd) });
            return true;
        }, IntPtr.Zero);
        return rows.ToArray();
    }
}
'@
$children = @(Get-CimInstance Win32_Process -Filter ("ParentProcessId = " + $ApplicationProcessId))
$godot = @($children | Where-Object { $_.Name -eq 'godot.exe' })
$owners = @($ApplicationProcessId) + @($godot | Select-Object -ExpandProperty ProcessId)
@{
    appPid=$ApplicationProcessId
    godotPids=@($godot | Select-Object -ExpandProperty ProcessId)
    childPids=@($children | Select-Object -ExpandProperty ProcessId)
    children=@($children | Select-Object ProcessId, ParentProcessId, Name, CommandLine)
    windows=[DesktopRuntimeWindows]::Snapshot($owners)
} | ConvertTo-Json -Depth 5
