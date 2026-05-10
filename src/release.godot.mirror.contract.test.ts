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
    expect(workflow).toContain('GODOT_MIRROR_TAG: "godot-mirror-v4.3-stable"');
    expect(workflow).toContain('GODOT_WINDOWS_ARCHIVE_SHA256: "8f2c75b734bd956027ae3ca92c41f78b5d5a255dacc0f20e4e3c523c545ad410"');
    expect(workflow).toContain('GODOT_LINUX_ARCHIVE_SHA256: "7de56444b130b10af84d19c7e0cf63cf9e9937ee4ba94364c3b7dd114253ca21"');
    expect(workflow).toContain('GODOT_MACOS_ARCHIVE_SHA256: "d17940b913b3f3bf54c941eeb09042099d93865c6e2638e09e20f7c649aa474a"');
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
});
