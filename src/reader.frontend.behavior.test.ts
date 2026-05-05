import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { JSDOM } from 'jsdom';

type ReaderHarness = {
  dom: JSDOM;
  window: any;
  document: Document;
  reader: any;
  cleanup: () => void;
};

function createReaderDom(): JSDOM {
  return new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <div id="reading-window" style="display:none">
          <div id="reading-content-box">
            <div id="reading-title"></div>
            <button id="btn-reader-close" type="button">close</button>
            <button id="btn-reader-lock" type="button">lock</button>
            <button id="btn-reader-zoom-in" type="button">+</button>
            <button id="btn-reader-zoom-out" type="button">-</button>
            <div id="reading-diagnostics"></div>
            <div id="reading-body"></div>
            <div id="reading-outline-body"></div>
          </div>
        </div>
      </body>
    </html>`,
    { url: 'http://127.0.0.1:3000/' }
  );
}

function loadReaderHarness(): ReaderHarness {
  const repoRoot = path.resolve(__dirname, '..');
  const scriptPath = path.join(repoRoot, 'src', 'frontend', 'reader.js');
  const source = fs.readFileSync(scriptPath, 'utf8');
  const dom = createReaderDom();
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() {
      return this.textContent || '';
    },
    set(value: string) {
      this.textContent = String(value || '');
    },
  });
  const sandbox: Record<string, unknown> = {
    window: dom.window as any,
    document: dom.window.document,
    console: {
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    fetch: jest.fn(),
    setTimeout,
    clearTimeout,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MouseEvent: dom.window.MouseEvent,
    NodeFilter: dom.window.NodeFilter,
    CSS: dom.window.CSS,
    URL,
    marked: {
      parse(markdown: string) {
        return `<p>${String(markdown || '')}</p>`;
      },
    },
    mermaid: undefined,
    renderMathInElement: undefined,
  };
  const windowRef = sandbox.window as any;
  windowRef.console = sandbox.console;
  windowRef.fetch = sandbox.fetch;
  windowRef.marked = sandbox.marked;
  windowRef.settingsManager = {
    get(group: string, key: string) {
      if (group === 'reading' && key === 'mode') {
        return 'window';
      }
      if (group === 'reading' && key === 'allowUnsafeHtml') {
        return false;
      }
      if (group === 'reading' && key === 'markdownEngine') {
        return 'auto';
      }
      return null;
    },
  };
  windowRef.NoteConnectionRuntime = {
    getBaseUrl: () => 'http://127.0.0.1:3000',
    buildUrl: (resourcePath: string) => `http://127.0.0.1:3000/${String(resourcePath || '').replace(/^\/+/, '')}`,
  };
  windowRef.i18n = {
    t(key: string) {
      if (key === 'reader_graphviz_unavailable') {
        return 'Graphviz unavailable from i18n';
      }
      return key;
    },
  };

  const context = vm.createContext(sandbox);
  new vm.Script(source, { filename: 'reader.js' }).runInContext(context);
  const reader = windowRef.reader;
  if (!reader) {
    throw new Error('Reader bootstrap failed in behavior harness.');
  }
  return {
    dom,
    window: windowRef,
    document: dom.window.document,
    reader,
    cleanup: () => dom.window.close(),
  };
}

describe('reader frontend behavior', () => {
  test('renders protocol outline with heading depth classes and navigates by block id', () => {
    const harness = loadReaderHarness();
    try {
      const scrollToProtocolBlock = jest.fn();
      const flashReaderBlockById = jest.fn();
      harness.reader.scrollToProtocolBlock = scrollToProtocolBlock;
      harness.reader.flashReaderBlockById = flashReaderBlockById;

      harness.reader.renderOutlineFromProtocol({
        anchors: [
          { anchorId: 'intro', text: 'Intro', level: 2, blockId: 3 },
          { anchorId: 'detail', text: 'Detail', level: 4, blockId: 8 },
        ],
      });

      const outlineItems = Array.from(
        harness.document.querySelectorAll('#reading-outline-body .reading-outline-item')
      ) as HTMLButtonElement[];
      expect(outlineItems).toHaveLength(2);
      expect(outlineItems[0].className).toContain('level-2');
      expect(outlineItems[1].className).toContain('level-4');

      outlineItems[1].click();
      expect(scrollToProtocolBlock).toHaveBeenCalledWith(8);
      expect(flashReaderBlockById).toHaveBeenCalledWith(8);
    } finally {
      harness.cleanup();
    }
  });

  test('updates active outline item while reader viewport scrolls across protocol blocks', () => {
    const harness = loadReaderHarness();
    try {
      harness.window.requestAnimationFrame = (callback: (timestamp: number) => void) => {
        callback(0);
        return 1;
      };
      const body = harness.reader.body as HTMLElement;
      let virtualScrollOffset = 0;

      Object.defineProperty(body, 'clientHeight', {
        configurable: true,
        value: 400,
      });
      Object.defineProperty(body, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          top: 0,
          left: 0,
          right: 800,
          bottom: 400,
          width: 800,
          height: 400,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      const appendProtocolBlock = (blockId: number, topAnchor: number): void => {
        const block = harness.document.createElement('section');
        block.className = 'reader-block';
        block.dataset.blockId = String(blockId);
        Object.defineProperty(block, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({
            top: topAnchor - virtualScrollOffset,
            left: 0,
            right: 800,
            bottom: topAnchor - virtualScrollOffset + 100,
            width: 800,
            height: 100,
            x: 0,
            y: topAnchor - virtualScrollOffset,
            toJSON: () => ({}),
          }),
        });
        body.appendChild(block);
      };

      appendProtocolBlock(1, 24);
      appendProtocolBlock(2, 220);
      appendProtocolBlock(3, 440);

      harness.reader.renderOutlineFromProtocol({
        anchors: [
          { anchorId: 'intro', text: 'Intro', level: 1, blockId: 1 },
          { anchorId: 'detail', text: 'Detail', level: 2, blockId: 2 },
          { anchorId: 'appendix', text: 'Appendix', level: 3, blockId: 3 },
        ],
      });

      let outlineItems = Array.from(
        harness.document.querySelectorAll('#reading-outline-body .reading-outline-item')
      ) as HTMLButtonElement[];
      expect(outlineItems).toHaveLength(3);
      expect(outlineItems[0].classList.contains('active')).toBe(true);

      virtualScrollOffset = 250;
      body.dispatchEvent(new harness.window.Event('scroll'));
      outlineItems = Array.from(
        harness.document.querySelectorAll('#reading-outline-body .reading-outline-item')
      ) as HTMLButtonElement[];
      expect(outlineItems[1].classList.contains('active')).toBe(true);

      virtualScrollOffset = 480;
      body.dispatchEvent(new harness.window.Event('scroll'));
      outlineItems = Array.from(
        harness.document.querySelectorAll('#reading-outline-body .reading-outline-item')
      ) as HTMLButtonElement[];
      expect(outlineItems[2].classList.contains('active')).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test('diagnostics report graphviz backend-unavailable when runtime capability probe is negative', () => {
    const harness = loadReaderHarness();
    try {
      harness.reader._readerCapabilities = {
        protocol: {
          activeEngine: 'legacy',
          engineFallbackApplied: false,
        },
        rendering: {
          mermaid: {
            frontend: true,
            backendPngFallback: true,
          },
          graphviz: {
            backendPngFallback: true,
            backendPngRuntimeAvailable: false,
          },
        },
      };
      harness.reader.renderReaderDiagnostics();

      const diagnostics = harness.document.getElementById('reading-diagnostics');
      const text = String(diagnostics?.textContent || '');
      expect(text).toContain('graphviz: backend-unavailable');
    } finally {
      harness.cleanup();
    }
  });

  test('diagnostics report unsupported diagram renderer hints without counting regular code languages', async () => {
    const harness = loadReaderHarness();
    try {
      const container = harness.document.createElement('div');
      container.innerHTML = [
        '<pre><code class="language-plantuml">@startuml\\nA -> B\\n@enduml</code></pre>',
        '<pre><code class="language-javascript">const n = 1;</code></pre>',
      ].join('');

      await harness.reader.renderCodeBlocksWithRegistry(container);

      const diagnostics = harness.document.getElementById('reading-diagnostics');
      const diagnosticsText = String(diagnostics?.textContent || '');
      expect(diagnosticsText).toContain('unsupported-renderers: plantuml (count=1)');
      expect(diagnosticsText).not.toContain('javascript');
    } finally {
      harness.cleanup();
    }
  });

  test('graphviz renderer degrades to inline error block when backend png render is unavailable', async () => {
    const harness = loadReaderHarness();
    try {
      const container = harness.document.createElement('div');
      container.innerHTML = '<pre><code class="language-graphviz">digraph G { A -> B; }</code></pre>';
      const renderGraphvizViaBackend = jest.fn().mockResolvedValue(null);
      harness.reader.renderGraphvizViaBackend = renderGraphvizViaBackend;

      await harness.reader.renderGraphvizInContainer(container);

      expect(renderGraphvizViaBackend).toHaveBeenCalledWith('digraph G { A -> B; }');
      const fallback = container.querySelector('.graphviz.graphviz-error');
      expect(fallback).not.toBeNull();
      expect(String(fallback?.textContent || '')).toContain('Graphviz unavailable from i18n');
      const diagnostics = harness.document.getElementById('reading-diagnostics');
      const diagnosticsText = String(diagnostics?.textContent || '');
      expect(diagnosticsText).toContain('graphviz-render: backend-png=0, failed=1');
    } finally {
      harness.cleanup();
    }
  });
});
