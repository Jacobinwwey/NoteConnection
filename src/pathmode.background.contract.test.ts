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

  test('startup path-mode restore keeps runtime background values intact', () => {
    const source = fs.readFileSync(pathRendererPath, 'utf8');
    expect(source).toContain('func _filter_startup_settings(settings: Dictionary) -> Dictionary:');
    expect(source).toContain('return settings.duplicate(true)');
  });

  test('desktop settings panel prefers runtime TOML over local cfg during load', () => {
    const source = fs.readFileSync(settingsPanelPath, 'utf8');
    expect(source).toContain('if not _runtime_base_url.is_empty():');
    expect(source).toContain('call_deferred("_load_settings_from_runtime_async")');
    expect(source).toContain('_load_settings_local()');
  });

  test('loads HDR backgrounds through the guarded resize-and-convert path', () => {
    const source = fs.readFileSync(pathRendererPath, 'utf8');
    expect(source).toContain('var _background_texture_cache: Dictionary = {}');
    expect(source).toContain('var _last_applied_background_path: String = "__unset__"');
    expect(source).toContain('func _load_hdr_background_safely(path: String) -> Texture2D:');
    expect(source).toContain('var imported_tex = ResourceLoader.load(path)');
    expect(source).toContain('var texture := imported_tex as Texture2D');
    expect(source).not.toContain('MAX_SAFE_HDR_BACKGROUND_BYTES');
    expect(source).not.toContain('(imported_tex as Texture2D).get_image()');
    expect(source).not.toContain('var image_error := image.load(path)');
  });
});
