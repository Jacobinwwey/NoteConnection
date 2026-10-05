import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

type Position = { id: string; x: number; y: number };
type TickMessage = { type: 'tick'; nodes: Position[]; alpha: number; tickMode: string };

describe('offline graph simulation worker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test.each(['force', 'dag'])('computes %s layout using only packaged dependencies', (mode) => {
    const frontend = path.join(__dirname, 'frontend');
    const ticks: TickMessage[] = [];
    const worker = vm.createContext({
      console: { log() {}, warn() {}, error() {} },
      Date,
      performance: { now: () => Date.now() },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      postMessage(message: TickMessage) {
        if (message.type === 'tick') ticks.push(message);
      },
    });
    worker.self = worker;
    worker.importScripts = (...scripts: string[]) => {
      for (const script of scripts) {
        const url = new URL(script, 'http://appimage.local/simulationWorker.js');
        if (url.origin !== 'http://appimage.local') {
          throw new Error(`External network is disabled: ${url.href}`);
        }
        const filename = path.join(frontend, url.pathname);
        vm.runInContext(fs.readFileSync(filename, 'utf8'), worker, { filename });
      }
    };
    vm.runInContext(fs.readFileSync(path.join(frontend, 'simulationWorker.js'), 'utf8'), worker);
    worker.onmessage({ data: { type: 'init', payload: {
      nodes: [{ id: 'start', rank: 0 }, { id: 'middle', rank: 1 }, { id: 'end', rank: 2 }],
      links: [{ source: 'start', target: 'middle' }, { source: 'middle', target: 'end' }],
      width: 800,
      height: 600,
      settings: { gpuRendering: false },
    } } });
    if (mode === 'dag') worker.onmessage({ data: { type: 'updateLayout', payload: { mode, width: 800 } } });
    jest.advanceTimersByTime(2500);
    worker.onmessage({ data: { type: 'stop' } });

    expect(ticks.length).toBeGreaterThan(5);
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    expect(last.tickMode).toBe('full');
    expect(last.nodes.map(node => node.id)).toEqual(['start', 'middle', 'end']);
    expect(Number.isFinite(last.alpha)).toBe(true);
    expect(last.alpha).toBeLessThan(first.alpha);
    for (const node of last.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      for (const other of last.nodes.filter(other => other.id !== node.id)) {
        expect(Math.hypot(node.x - other.x, node.y - other.y)).toBeGreaterThan(1);
      }
    }
    expect(last.nodes.some((node, index) => Math.hypot(node.x - first.nodes[index].x, node.y - first.nodes[index].y) > 1)).toBe(true);
    if (mode === 'dag') {
      expect(last.nodes[0].y).toBeLessThan(last.nodes[1].y);
      expect(last.nodes[1].y).toBeLessThan(last.nodes[2].y);
    }
  });
});
