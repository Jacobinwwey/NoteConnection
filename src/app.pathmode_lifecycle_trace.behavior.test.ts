import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { JSDOM } from 'jsdom';

describe('app pathmode lifecycle trace behavior', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const appSourcePath = path.join(repoRoot, 'src', 'frontend', 'app.js');

  function extractLifecycleObserverBlock(source: string): string {
    const startMarker = 'if (\n    window.__TAURI__ &&';
    const endMarker = '\nif (btnNotemd) {';
    const start = source.indexOf(startMarker);
    if (start < 0) {
      throw new Error('Unable to locate Tauri lifecycle observer start block in app.js');
    }

    const end = source.indexOf(endMarker, start);
    if (end < 0) {
      throw new Error('Unable to locate Tauri lifecycle observer end block in app.js');
    }

    return source.slice(start, end);
  }

  test('stores bounded pathmode lifecycle traces and dispatches DOM events from tauri payloads', () => {
    const source = fs.readFileSync(appSourcePath, 'utf8');
    const lifecycleBlock = extractLifecycleObserverBlock(source);

    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'http://localhost/',
      pretendToBeVisual: true,
    });

    const tauriListeners = new Map<string, Array<(event: { payload?: unknown }) => void>>();
    const lifecycleDomEvents: Array<Record<string, unknown>> = [];

    dom.window.__TAURI__ = {
      event: {
        listen: (eventName: string, callback: (event: { payload?: unknown }) => void) => {
          const listeners = tauriListeners.get(eventName) || [];
          listeners.push(callback);
          tauriListeners.set(eventName, listeners);
          return Promise.resolve(() => {});
        },
      },
    } as unknown as typeof dom.window.__TAURI__;

    dom.window.addEventListener('noteconnection:pathmode-window-toggled', (event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      lifecycleDomEvents.push(detail);
    });

    const sandbox = {
      window: dom.window,
      CustomEvent: dom.window.CustomEvent,
      Date,
      console: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
      showEmbeddedNoteMD: () => {},
    };

    vm.createContext(sandbox);
    new vm.Script(`(function(){\n${lifecycleBlock}\n})();`, {
      filename: 'app.js#pathmode-lifecycle-block',
    }).runInContext(sandbox as vm.Context);

    const pathmodeCallbacks = tauriListeners.get('pathmode-window-toggled') || [];
    expect(pathmodeCallbacks.length).toBe(1);

    const callback = pathmodeCallbacks[0];
    for (let index = 0; index < 40; index += 1) {
      callback({
        payload: {
          showGodot: index % 2 === 0,
          triggeredAtMs: index,
          config: { sequence: index },
          plan: { sendPathmodeShow: index % 2 === 0 },
        },
      });
    }

    const lifecycleState = (dom.window as unknown as Record<string, unknown>).__NC_TAURI_PATHMODE_LIFECYCLE__ as {
      events: Array<Record<string, unknown>>;
      lastEvent: Record<string, unknown> | null;
    };

    expect(lifecycleState).toBeDefined();
    expect(Array.isArray(lifecycleState.events)).toBe(true);
    expect(lifecycleState.events.length).toBe(32);
    expect((lifecycleState.events[0].config as Record<string, unknown>).sequence).toBe(8);
    expect((lifecycleState.lastEvent?.config as Record<string, unknown>).sequence).toBe(39);

    callback({ payload: null });

    expect(lifecycleState.events.length).toBe(32);
    const finalEvent = lifecycleState.lastEvent as Record<string, unknown>;
    expect(finalEvent.showGodot).toBe(false);
    expect(finalEvent.triggeredAtMs).toBe(0);
    expect(finalEvent.config).toEqual({});
    expect(finalEvent.plan).toEqual({});

    expect(lifecycleDomEvents.length).toBe(41);
    expect(lifecycleDomEvents[lifecycleDomEvents.length - 1]).toBe(finalEvent);
  });
});
