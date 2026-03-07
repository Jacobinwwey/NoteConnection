#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const targetRoot = path.join(repoRoot, 'src-tauri', 'target');
const targetModes = ['debug', 'release'];
const sidecarNames = ['server', 'godot'];

function loadCargoPackageName() {
  try {
    const cargoToml = fs.readFileSync(path.join(repoRoot, 'src-tauri', 'Cargo.toml'), 'utf8');
    const match = cargoToml.match(/^name\s*=\s*"([^"]+)"/m);
    return match && match[1] ? match[1].trim() : 'npm';
  } catch (_error) {
    return 'npm';
  }
}

function buildCandidatePaths() {
  const candidates = [];
  const binaryNames = [...new Set([...sidecarNames, loadCargoPackageName()])];
  for (const mode of targetModes) {
    for (const name of binaryNames) {
      candidates.push(
        process.platform === 'win32'
          ? path.join(targetRoot, mode, `${name}.exe`)
          : path.join(targetRoot, mode, name)
      );
    }
  }
  return candidates;
}

function existingCandidates(candidates) {
  return candidates.filter((candidate) => fs.existsSync(candidate));
}

function quotePowerShellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runPowerShellCleanup(targetPaths) {
  const loweredTargets = targetPaths.map((target) => path.resolve(target).toLowerCase());
  const targetArrayLiteral = loweredTargets.map(quotePowerShellString).join(', ');
  const script = `
$targets = @(${targetArrayLiteral})
$killed = @()
for ($pass = 0; $pass -lt 4; $pass++) {
  $matches = @()
  $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -ne $null }
  foreach ($proc in $procs) {
    $procPath = ''
    try {
      $procPath = [System.IO.Path]::GetFullPath($proc.ExecutablePath).ToLowerInvariant()
    } catch {
      continue
    }
    if ($targets -contains $procPath) {
      $matches += [PSCustomObject]@{ Id = [int]$proc.ProcessId; Path = $procPath }
    }
  }
  if ($matches.Count -eq 0) {
    break
  }
  foreach ($match in ($matches | Sort-Object Id -Unique)) {
    try {
      & taskkill.exe /PID $match.Id /T /F | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw "taskkill exited with code $LASTEXITCODE"
      }
      $killed += "KILLED|$($match.Id)|$($match.Path)"
    } catch {
      Write-Output "FAILED|$($match.Id)|$($match.Path)|$($_.Exception.Message)"
      exit 2
    }
  }
  Start-Sleep -Milliseconds 600
}
$remaining = @()
$procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -ne $null }
foreach ($proc in $procs) {
  $procPath = ''
  try {
    $procPath = [System.IO.Path]::GetFullPath($proc.ExecutablePath).ToLowerInvariant()
  } catch {
    continue
  }
  if ($targets -contains $procPath) {
    $remaining += "REMAINING|$($proc.ProcessId)|$procPath"
  }
}
$killed | Sort-Object -Unique | ForEach-Object { Write-Output $_ }
if ($remaining.Count -gt 0) {
  $remaining | Sort-Object -Unique | ForEach-Object { Write-Output $_ }
  exit 3
}
`;

  return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function listPosixMatchingPids(targetPaths) {
  const ps = spawnSync('ps', ['-ax', '-o', 'pid=', '-o', 'command='], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (ps.status !== 0) {
    throw new Error(ps.stderr || 'Failed to inspect running processes with ps.');
  }

  const normalizedTargets = targetPaths.map((target) => path.resolve(target));
  const matches = [];
  for (const rawLine of ps.stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\d+)\s+(.*)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const command = match[2];
    if (!Number.isFinite(pid) || pid === process.pid) continue;
    if (normalizedTargets.some((target) => command.includes(target))) {
      matches.push({ pid, command });
    }
  }
  return matches;
}

function runPosixCleanup(targetPaths) {
  const matches = listPosixMatchingPids(targetPaths);
  const logs = [];
  for (const match of matches) {
    try {
      process.kill(match.pid, 'SIGTERM');
      logs.push(`KILLED|${match.pid}|${match.command}`);
    } catch (error) {
      return {
        status: 2,
        stdout: logs.join('\n'),
        stderr: String(error?.message || error),
      };
    }
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);

  const remaining = listPosixMatchingPids(targetPaths);
  if (remaining.length > 0) {
    for (const match of remaining) {
      try {
        process.kill(match.pid, 'SIGKILL');
        logs.push(`KILLED|${match.pid}|${match.command}|SIGKILL`);
      } catch (error) {
        return {
          status: 3,
          stdout: logs.join('\n'),
          stderr: String(error?.message || error),
        };
      }
    }
  }

  return {
    status: 0,
    stdout: logs.join('\n'),
    stderr: '',
  };
}

function main() {
  const candidates = buildCandidatePaths();
  const presentCandidates = existingCandidates(candidates);
  const targets = presentCandidates.length > 0 ? presentCandidates : candidates;

  console.log('[Tauri Sidecar Cleanup] Inspecting copied sidecars and app binaries:');
  targets.forEach((target) => console.log(`  - ${target}`));

  const result = process.platform === 'win32'
    ? runPowerShellCleanup(targets)
    : runPosixCleanup(targets);

  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  if (stdout) {
    stdout.split(/\r?\n/).forEach((line) => console.log(`[Tauri Sidecar Cleanup] ${line}`));
  }
  if (stderr) {
    stderr.split(/\r?\n/).forEach((line) => console.error(`[Tauri Sidecar Cleanup] ${line}`));
  }

  if (result.status !== 0) {
    console.error('[Tauri Sidecar Cleanup] Failed to terminate stale copied sidecars or app binaries. Close any existing Tauri/Godot dev instances and retry.');
    process.exit(result.status || 1);
  }

  console.log('[Tauri Sidecar Cleanup] No stale copied sidecars or app binaries remain.');
}

main();