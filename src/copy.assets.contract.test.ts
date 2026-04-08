import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type CopyAssetsModule = {
  copyProjectAssets: (options: {
    src: string;
    dest: string;
    includeGeneratedGraphAssets?: boolean;
    logger?: Pick<Console, 'log' | 'warn' | 'error'>;
  }) => void;
};

class TempDir {
  readonly path: string;

  constructor(prefix: string) {
    this.path = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
  }

  child(relative: string): string {
    return path.join(this.path, relative);
  }

  mkdir(relative: string): string {
    const target = this.child(relative);
    fs.mkdirSync(target, { recursive: true });
    return target;
  }

  file(relative: string, content: string): string {
    const target = this.child(relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    return target;
  }

  cleanup(): void {
    fs.rmSync(this.path, { recursive: true, force: true });
  }
}

describe('copy-assets runtime-first contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const copyAssetsPath = path.join(repoRoot, 'scripts', 'copy-assets.js');
  let temp: TempDir;
  let srcDir: string;
  let destDir: string;
  let copyProjectAssets: CopyAssetsModule['copyProjectAssets'];

  beforeAll(() => {
    ({ copyProjectAssets } = require(copyAssetsPath) as CopyAssetsModule);
  });

  beforeEach(() => {
    temp = new TempDir('noteconnection-copy-assets');
    srcDir = temp.mkdir('src');
    destDir = temp.mkdir('dest');
  });

  afterEach(() => {
    temp.cleanup();
  });

  test('excludes generated graph payloads by default', () => {
    temp.file(path.join('src', 'app.js'), 'console.log("app");');
    temp.file(path.join('src', 'data.js'), 'const graphData = {"nodes":[{"id":"A"}],"edges":[]}');
    temp.file(path.join('src', 'graph_data.json'), '{"nodes":[{"id":"A"}],"edges":[]}');

    copyProjectAssets({
      src: srcDir,
      dest: destDir,
      logger: console
    });

    expect(fs.existsSync(path.join(destDir, 'app.js'))).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'data.js'))).toBe(false);
    expect(fs.existsSync(path.join(destDir, 'graph_data.json'))).toBe(false);
  });

  test('copies generated graph payloads only when explicitly requested', () => {
    temp.file(path.join('src', 'data.js'), 'const graphData = {"nodes":[{"id":"A"}],"edges":[]}');
    temp.file(path.join('src', 'graph_data.json'), '{"nodes":[{"id":"A"}],"edges":[]}');

    copyProjectAssets({
      src: srcDir,
      dest: destDir,
      includeGeneratedGraphAssets: true,
      logger: console
    });

    expect(fs.existsSync(path.join(destDir, 'data.js'))).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'graph_data.json'))).toBe(true);
  });

  test('full mode remains valid when repository head no longer ships bundled graph payload files', () => {
    temp.file(path.join('src', 'app.js'), 'console.log("app");');

    expect(() =>
      copyProjectAssets({
        src: srcDir,
        dest: destDir,
        includeGeneratedGraphAssets: true,
        logger: console
      })
    ).not.toThrow();

    expect(fs.existsSync(path.join(destDir, 'app.js'))).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'data.js'))).toBe(false);
    expect(fs.existsSync(path.join(destDir, 'graph_data.json'))).toBe(false);
  });

  test('does not copy LFS pointer placeholders even in explicit full mode', () => {
    temp.file(
      path.join('src', 'data.js'),
      [
        'version https://git-lfs.github.com/spec/v1',
        'oid sha256:abc123',
        'size 177419264'
      ].join('\n')
    );

    copyProjectAssets({
      src: srcDir,
      dest: destDir,
      includeGeneratedGraphAssets: true,
      logger: console
    });

    expect(fs.existsSync(path.join(destDir, 'data.js'))).toBe(false);
  });
});
