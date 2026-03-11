import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
    scripts?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('wasm parity history gate contract', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const packageJsonPath = path.join(repoRoot, 'package.json');
    const workflowPath = path.join(repoRoot, '.github', 'workflows', 'wasm-parity-benchmark-snapshots.yml');
    const benchmarkScriptPath = path.join(repoRoot, 'scripts', 'benchmark-wasm-parity.js');

    test('keeps history-aware benchmark scripts wired in package.json', () => {
        const pkg = readJson<PackageJson>(packageJsonPath);
        const scripts = pkg.scripts || {};

        expect(scripts['benchmark:wasm:parity:history']).toContain('--minimum-history-samples 5');
        expect(scripts['benchmark:wasm:parity:history']).toContain('--history-strict-samples 15');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--minimum-history-samples 5');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--history-strict-samples 15');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--bootstrap-history-guard 1');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--history-maturity-warn-tier warming');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--history-maturity-fail-tier none');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--history-performance-fail-mode enforced-only');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--history-max-records 3000');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--history-max-age-days 180');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--max-candidate-to-history-graph-p95-ratio 1.25');
        expect(scripts['benchmark:wasm:parity:history:ci']).toContain('--max-candidate-to-history-layout-p99-ratio 1.25');
        expect(scripts['benchmark:wasm:parity:history:release']).toContain('--history-maturity-fail-tier enforced');
        expect(scripts['benchmark:wasm:parity:history:release']).toContain('--history-performance-fail-mode always');
        expect(scripts['test:migration']).toContain('src/wasm.parity.history.gate.contract.test.ts');
    });

    test('snapshot workflow runs strict + history-aware wasm parity checks using shared history file', () => {
        const workflow = fs.readFileSync(workflowPath, 'utf8');

        expect(workflow).toContain('WASM_HISTORY_DIR');
        expect(workflow).toContain('WASM_HISTORY_FILE');
        expect(workflow).toContain('Restore wasm parity history cache');
        expect(workflow).toContain('actions/cache/restore@v4');

        expect(workflow).toContain('Run strict parity benchmark snapshot');
        expect(workflow).toContain('benchmark:wasm:parity:strict:perf');
        expect(workflow).toContain('--history-file ${{ env.WASM_HISTORY_FILE }}');

        expect(workflow).toContain('Run history-aware parity regression gate');
        expect(workflow).toContain('benchmark:wasm:parity:history:ci');
        expect(workflow).toContain('Print history readiness summary');
        expect(workflow).toContain('history-readiness-latest.md');
        expect(workflow).toContain('Save wasm parity history cache');
        expect(workflow).toContain('actions/cache/save@v4');
    });

    test('benchmark runner supports bootstrap mode for history guard readiness', () => {
        const script = fs.readFileSync(benchmarkScriptPath, 'utf8');

        expect(script).toContain("args['bootstrap-history-guard']");
        expect(script).toContain("args['history-max-records']");
        expect(script).toContain("args['history-max-age-days']");
        expect(script).toContain('compactWasmParityHistoryRecords');
        expect(script).toContain('historyGuardBootstrapActive');
        expect(script).toContain('History guard bootstrap mode is active');
        expect(script).toContain('History compaction:');
        expect(script).toContain("args['history-strict-samples']");
        expect(script).toContain("args['history-maturity-warn-tier']");
        expect(script).toContain("args['history-maturity-fail-tier']");
        expect(script).toContain("args['history-performance-fail-mode']");
        expect(script).toContain('history-readiness-latest.json');
        expect(script).toContain('history-readiness-latest.md');
        expect(script).toContain('summarizeWasmParityHistoryReadiness');
        expect(script).toContain('History maturity tier:');
        expect(script).toContain('History performance policy decision:');
    });
});
