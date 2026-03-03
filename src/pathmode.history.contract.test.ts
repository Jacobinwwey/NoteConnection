import * as fs from 'fs';
import * as path from 'path';

describe('path mode history recording contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const uiPath = path.join(repoRoot, 'path_mode', 'scripts', 'path_mode_ui.gd');
  const rendererPath = path.join(repoRoot, 'path_mode', 'scripts', 'path_renderer.gd');

  test('path mode UI exposes explicit navigation recorder for center switches', () => {
    const uiScript = fs.readFileSync(uiPath, 'utf8');
    expect(uiScript).toContain('func record_navigation_node(node_id: String) -> void:');
    expect(uiScript).toContain('if not _is_browsing:');
    expect(uiScript).toContain('_nav_history.append(node_id)');
  });

  test('renderer records central-node switches into history during path render updates', () => {
    const rendererScript = fs.readFileSync(rendererPath, 'utf8');
    expect(rendererScript).toContain('ui.record_navigation_node(central_id)');
    expect(rendererScript).toContain('func render_path(path_data: Dictionary) -> void:');
  });
});
