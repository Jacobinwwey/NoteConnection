import * as fs from 'fs';
import * as path from 'path';

describe('release workflow godot mirror contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const workflowPath = path.join(
    repoRoot,
    '.github',
    'workflows',
    'release-desktop-multi-os.yml'
  );

  test('release workflow seeds a project-controlled godot mirror and builds from that mirror first', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('allow_godot_upstream_fallback:');
    expect(workflow).toContain('description: "Allow desktop release jobs to fall back to the upstream Godot release when the project mirror is unavailable."');
    expect(workflow).toContain('default: true');
    expect(workflow).toContain('type: boolean');
    expect(workflow.match(/node scripts\/write-godot-desktop-ci-env\.js/g)).toHaveLength(2);
    expect(workflow).toContain('${GODOT_LINUX_ARCHIVE_NAME%.zip}');
    expect(workflow).toContain(
      "GODOT_ALLOW_UPSTREAM_FALLBACK: ${{ github.event_name != 'workflow_dispatch' || github.event.inputs.allow_godot_upstream_fallback != 'false' }}"
    );
    expect(workflow).toContain('ensure-godot-mirror-assets:');
    expect(workflow).toContain('gh release view "$GODOT_MIRROR_TAG" --repo "$GITHUB_REPOSITORY"');
    expect(workflow).toContain('gh release create "$GODOT_MIRROR_TAG" \\');
    expect(workflow).toContain('--repo "$GITHUB_REPOSITORY" \\');
    expect(workflow).toContain('--target "$GITHUB_SHA" \\');
    expect(workflow).toContain('EXPECTED_SHA256="$(expected_sha256_for_asset "$ASSET_NAME")"');
    expect(workflow).toContain('sha256sum "$ARCHIVE_PATH"');
    expect(workflow).toContain('Archive digest mismatch for $ASSET_NAME');
    expect(workflow).toContain('gh release upload "$GODOT_MIRROR_TAG" "$ARCHIVE_PATH" --repo "$GITHUB_REPOSITORY" --clobber');
    expect(workflow).toContain(
      'https://github.com/Jacobinwwey/NoteConnection/releases/download/${GODOT_MIRROR_TAG}'
    );
    expect(workflow).toContain('$allowUpstreamFallback = "$env:GODOT_ALLOW_UPSTREAM_FALLBACK".ToLower() -eq "true"');
    expect(workflow).toContain('if (-not $allowUpstreamFallback) {');
    expect(workflow).toContain('throw "Project mirror download failed and upstream fallback is disabled');
    expect(workflow).toContain('if [ "${GODOT_ALLOW_UPSTREAM_FALLBACK}" != "true" ]; then');
    expect(workflow).toContain('echo "::error::Project mirror download failed and upstream fallback is disabled."');
    expect(workflow).toContain('Get-FileHash -Path $archive -Algorithm SHA256');
    expect(workflow).toContain('Downloaded Godot archive digest mismatch');
    expect(workflow).toContain('ACTUAL_SHA256="$(sha256sum build/godot/godot-linux.zip | awk \'{print $1}\')"');
    expect(workflow).toContain('ACTUAL_SHA256="$(sha256sum build/godot/godot-macos.zip | awk \'{print $1}\')"');
    expect(workflow).toContain('needs: [ensure-release, ensure-godot-mirror-assets]');
  });

  test('exports checksummed engine archives matching the declared Godot project version', () => {
    const runtime = require('../config/godot-desktop-runtime.json');
    const { writeGodotDesktopCiEnvironment } = require('../scripts/write-godot-desktop-ci-env');
    const project = fs.readFileSync(path.join(repoRoot, 'path_mode/project.godot'), 'utf8');
    expect(project).toContain(`PackedStringArray("${runtime.version}"`);
    const directory = fs.mkdtempSync(path.join(fs.realpathSync(require('os').tmpdir()), 'godot-ci-env-'));
    const destination = path.join(directory, 'env');
    try {
      writeGodotDesktopCiEnvironment(destination);
      const environment = Object.fromEntries(fs.readFileSync(destination, 'utf8').trim().split('\n').map(line => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }));
      expect(environment.GODOT_MIRROR_TAG).toBe(runtime.mirrorTag);
      for (const platform of ['windows', 'linux', 'macos']) {
        const archive = runtime.archives[platform];
        expect(archive.name).toContain(`Godot_v${runtime.version}-stable`);
        expect(archive.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(environment[`GODOT_${platform.toUpperCase()}_ARCHIVE_NAME`]).toBe(archive.name);
        expect(environment[`GODOT_${platform.toUpperCase()}_ARCHIVE_SHA256`]).toBe(archive.sha256);
      }
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
