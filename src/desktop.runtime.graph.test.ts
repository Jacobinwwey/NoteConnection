import * as vm from 'node:vm';

const { waitForAcceptanceGraph } = require('../scripts/verify-desktop-runtime');
const graph = { nodes: [{ id: 'Alpha' }, { id: 'Beta' }], edges: [{ source: 'Alpha', target: 'Beta' }] };

test('waits past the build reload and returns one snapshot from the ready document', async () => {
  const pages = [
    vm.createContext({ performance: { timeOrigin: 100 }, graphData: graph }),
    vm.createContext({ performance: { timeOrigin: 200 } }),
    vm.createContext({ performance: { timeOrigin: 200 }, graphData: graph }),
  ];
  const evaluate = jest.fn(async (expression: string) => {
    const page = pages.shift();
    if (!page) throw new Error('Unexpected extra WebView read');
    return vm.runInContext(expression, page);
  });
  await expect(waitForAcceptanceGraph({ evaluate }, 100)).resolves.toEqual({ nodes: ['Alpha', 'Beta'], edges: 1 });
  expect(evaluate).toHaveBeenCalledTimes(3);
});

test('captures lexical graphData and its links before another CDP request can replace the document', async () => {
  const page = vm.createContext({ performance: { timeOrigin: 200 } });
  vm.runInContext(`const graphData = ${JSON.stringify({ nodes: graph.nodes, links: graph.edges })}`, page);
  const evaluate = jest.fn(async (expression: string) => {
    const snapshot = vm.runInContext(expression, page);
    // Navigation destroys the document after this single serialized CDP response.
    if (evaluate.mock.calls.length > 1) throw new Error('Execution context was destroyed');
    return snapshot;
  });
  await expect(waitForAcceptanceGraph({ evaluate }, 100)).resolves.toEqual({ nodes: ['Alpha', 'Beta'], edges: 1 });
  expect(evaluate).toHaveBeenCalledTimes(1);
});
