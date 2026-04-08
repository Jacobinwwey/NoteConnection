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

    expect(workflow).toContain('GODOT_MIRROR_TAG: "godot-mirror-v4.3-stable"');
    expect(workflow).toContain('ensure-godot-mirror-assets:');
    expect(workflow).toContain('gh release create "$GODOT_MIRROR_TAG" \\');
    expect(workflow).toContain('--target "$GITHUB_SHA" \\');
    expect(workflow).toContain('gh release upload "$GODOT_MIRROR_TAG"');
    expect(workflow).toContain(
      'https://github.com/Jacobinwwey/NoteConnection/releases/download/${GODOT_MIRROR_TAG}'
    );
    expect(workflow).toContain('needs: [ensure-release, ensure-godot-mirror-assets]');
  });
});
