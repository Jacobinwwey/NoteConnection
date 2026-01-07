import { parentPort, workerData } from 'worker_threads';
import { CrashLogger } from '../utils/CrashLogger';

CrashLogger.initGlobalHandlers();

interface WorkerInput {
    startNodeIds: string[];
    allNodeIds: string[];
    adj: Record<string, string[]>; // outgoing edges
}

// Result: partial betweenness centrality map
// 结果：部分介数中心性映射
type WorkerResult = Record<string, number>;

try {
    const { startNodeIds, allNodeIds, adj } = workerData as WorkerInput;
    const cb: WorkerResult = {};

    // Initialize result map
    // 初始化结果映射
    // We only need to return values > 0 to save serialization size, but for simplicity let's follow the standard.
    // 我们只需要返回值 > 0 以节省序列化大小，但为了简单起见，让我们遵循标准。
    // Optimization: Only store non-zero values in the final map to merge.
    // 优化：仅在最终映射中存储非零值以进行合并。

    startNodeIds.forEach(s => {
        const stack: string[] = [];
        const P: Record<string, string[]> = {};
        const sigma: Record<string, number> = {};
        const d: Record<string, number> = {};

        // Initialization
        // 初始化
        for (const v of allNodeIds) {
            P[v] = [];
            sigma[v] = 0;
            d[v] = -1;
        }

        sigma[s] = 1;
        d[s] = 0;

        const Q: string[] = [s];

        while (Q.length > 0) {
            const v = Q.shift()!;
            stack.push(v);

            const neighbors = adj[v] || [];
            for (const w of neighbors) {
                // Path discovery
                // 路径发现
                if (d[w] === -1) {
                    d[w] = d[v] + 1;
                    Q.push(w);
                }
                // Path counting
                // 路径计数
                if (d[w] === d[v] + 1) {
                    sigma[w] = sigma[w] + sigma[v];
                    P[w].push(v);
                }
            }
        }

        const delta: Record<string, number> = {};
        for (const v of allNodeIds) {
            delta[v] = 0;
        }

        // Accumulation
        // 累积
        while (stack.length > 0) {
            const w = stack.pop()!;
            for (const v of P[w]) {
                // Brandes dependency formula
                if (sigma[w] !== 0) {
                    delta[v] = delta[v] + (sigma[v] / sigma[w]) * (1 + delta[w]);
                }
            }
            if (w !== s) {
                cb[w] = (cb[w] || 0) + delta[w];
            }
        }
    });

    if (parentPort) {
        parentPort.postMessage(cb);
    }

} catch (error) {
    CrashLogger.log(error, 'BetweennessWorker');
    process.exit(1);
}
