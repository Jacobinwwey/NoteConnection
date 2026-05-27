#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const defaultTargetRoots = [
  path.join(repoRoot, 'src-tauri', 'target'),
  path.join(repoRoot, 'src-tauri', 'target-dev-lowmem'),
  path.join(repoRoot, 'tmp', 'cargo-target-dev-lowmem'),
];
const preservedTargetRoots = new Set(defaultTargetRoots.map((root) => path.resolve(root)));
const targetModes = ['debug', 'release'];
const sidecarNames = ['server', 'godot', 'markdown-worker'];

function loadCargoPackageName() {
  try {
    const cargoToml = fs.readFileSync(path.join(repoRoot, 'src-tauri', 'Cargo.toml'), 'utf8');
    const match = cargoToml.match(/^name\s*=\s*"([^"]+)"/m);
    return match && match[1] ? match[1].trim() : 'npm';
  } catch (_error) {
    return 'npm';
  }
}

function resolveTargetRoots() {
  const roots = [...defaultTargetRoots];
  const dynamicRootSpecs = [
    { dir: path.join(repoRoot, 'src-tauri'), prefix: 'target-dev-lowmem-' },
    { dir: path.join(repoRoot, 'tmp'), prefix: 'cargo-target-dev-lowmem-' },
  ];
  for (const spec of dynamicRootSpecs) {
    try {
      const dynamicRoots = fs.readdirSync(spec.dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(spec.prefix))
        .map((entry) => path.join(spec.dir, entry.name));
      roots.push(...dynamicRoots);
    } catch (_error) {
      // Ignore scan failures and fall back to the stable target roots.
    }
  }
  const envTargetDir = String(process.env.CARGO_TARGET_DIR || '').trim();
  if (envTargetDir) {
    roots.push(path.isAbsolute(envTargetDir) ? envTargetDir : path.resolve(repoRoot, envTargetDir));
  }

  return [...new Set(roots.map((root) => path.resolve(root)))];
}

function buildCandidatePaths() {
  const candidates = [];
  const binaryNames = [...new Set([...sidecarNames, loadCargoPackageName()])];
  for (const targetRoot of resolveTargetRoots()) {
    for (const mode of targetModes) {
      for (const name of binaryNames) {
        candidates.push(
          process.platform === 'win32'
            ? path.join(targetRoot, mode, `${name}.exe`)
            : path.join(targetRoot, mode, name)
        );
      }
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

function runPowerShellNameFallbackCleanup(targetPath) {
  const targetName = path.basename(targetPath);
  const expectedUser = String(process.env.USERNAME || '').trim();
  const expectedDomain = String(process.env.COMPUTERNAME || '').trim();
  const script = `
$targetName = ${quotePowerShellString(targetName)}
$expectedUser = ${quotePowerShellString(expectedUser)}
$expectedDomain = ${quotePowerShellString(expectedDomain)}
$killed = @()
$candidates = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -ieq $targetName }
foreach ($candidate in $candidates) {
  $owner = $null
  try {
    $owner = Invoke-CimMethod -InputObject $candidate -MethodName GetOwner -ErrorAction Stop
  } catch {
    continue
  }
  if (-not $owner -or $owner.ReturnValue -ne 0) {
    continue
  }
  if ($expectedUser -and $owner.User -ne $expectedUser) {
    continue
  }
  if ($expectedDomain -and $owner.Domain -and $owner.Domain -ne $expectedDomain) {
    continue
  }
  try {
    & taskkill.exe /PID $candidate.ProcessId /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "taskkill exited with code $LASTEXITCODE"
    }
    $killed += "KILLED_BY_NAME|$($candidate.ProcessId)|$targetName|$($owner.Domain)\\$($owner.User)"
  } catch {
    Write-Output "FAILED_BY_NAME|$($candidate.ProcessId)|$targetName|$($_.Exception.Message)"
    exit 2
  }
}
$killed | Sort-Object -Unique | ForEach-Object { Write-Output $_ }
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

function removeExistingArtifacts(targetPaths) {
  const removed = [];
  for (const targetPath of targetPaths) {
    if (!fs.existsSync(targetPath)) {
      continue;
    }
    const resolvedTargetPath = path.resolve(targetPath);
    const shouldPreserve = Array.from(preservedTargetRoots).some((root) => (
      resolvedTargetPath === root || resolvedTargetPath.startsWith(`${root}${path.sep}`)
    ));
    if (shouldPreserve) {
      continue;
    }
    try {
      fs.unlinkSync(targetPath);
      removed.push(targetPath);
    } catch (error) {
      const isPermissionDenied = process.platform === 'win32'
        && error
        && (error.code === 'EPERM' || error.code === 'EACCES');
      if (isPermissionDenied) {
        const fallbackResult = runPowerShellNameFallbackCleanup(targetPath);
        const fallbackStdout = String(fallbackResult.stdout || '').trim();
        const fallbackStderr = String(fallbackResult.stderr || '').trim();
        if (fallbackStdout) {
          fallbackStdout.split(/\r?\n/).forEach((line) => console.log(`[Tauri Sidecar Cleanup] ${line}`));
        }
        if (fallbackStderr) {
          fallbackStderr.split(/\r?\n/).forEach((line) => console.error(`[Tauri Sidecar Cleanup] ${line}`));
        }
        if (!fallbackResult.error && fallbackResult.status === 0) {
          try {
            fs.unlinkSync(targetPath);
            removed.push(targetPath);
            continue;
          } catch (retryError) {
            error = retryError;
          }
        }
      }
      return {
        ok: false,
        error: error,
        targetPath,
        removed,
      };
    }
  }

  return {
    ok: true,
    removed,
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

  const removal = removeExistingArtifacts(targets);
  if (!removal.ok) {
    console.error(
      `[Tauri Sidecar Cleanup] Failed to remove stale copied binary ${removal.targetPath}: ${
        String(removal.error && removal.error.message ? removal.error.message : removal.error)
      }`
    );
    process.exit(4);
  }
  removal.removed.forEach((targetPath) => {
    console.log(`[Tauri Sidecar Cleanup] REMOVED|${targetPath}`);
  });

  console.log('[Tauri Sidecar Cleanup] No stale copied sidecars or app binaries remain.');
}

main();
