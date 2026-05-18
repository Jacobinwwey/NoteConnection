import * as fs from 'fs';
import * as path from 'path';

describe('pathmode background safety contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const settingsPanelPath = path.join(repoRoot, 'path_mode', 'scripts', 'settings_panel.gd');
  const pathRendererPath = path.join(repoRoot, 'path_mode', 'scripts', 'path_renderer.gd');

  test('does not default path mode to a heavy HDR background at startup', () => {
    const source = fs.readFileSync(settingsPanelPath, 'utf8');
    expect(source).toContain('"background": ""');
    expect(source).not.toContain('"background": "belfast_sunset_puresky_4k.exr"');
  });

  test('loads HDR backgrounds through the guarded resize-and-convert path', () => {
    const source = fs.readFileSync(pathRendererPath, 'utf8');
    expect(source).toContain('const BACKGROUND_MAX_DIMENSION := 2048');
    expect(source).toContain('func _load_hdr_background_safely(path: String) -> Texture2D:');
    expect(source).toContain('image.convert(Image.FORMAT_RGBA8)');
    expect(source).toContain('image.resize(resized_width, resized_height, Image.INTERPOLATE_LANCZOS)');
  });
});
