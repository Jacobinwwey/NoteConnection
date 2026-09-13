import { spawnSync } from 'child_process';

jest.mock('child_process', () => ({ ...jest.requireActual('child_process'), spawnSync: jest.fn() }));

const { runRustWindowEvidenceTests } = require('../scripts/verify-agent-workspace-tauri-window-evidence');
const spawn = spawnSync as jest.Mock;

describe('native window test execution evidence', () => {
    afterEach(() => jest.clearAllMocks());

    test.each([
        ['empty filter', 'running 0 tests\n\ntest result: ok. 0 passed; 0 failed; 0 ignored; 30 filtered out;\n'],
        ['ignored test', 'test tests::{name} ... ignored\n\ntest result: ok. 0 passed; 0 failed; 1 ignored;\n'],
        ['different test', 'test tests::some_other_test ... ok\n\ntest result: ok. 1 passed; 0 failed; 0 ignored;\n'],
        ['failed test', 'test tests::{name} ... FAILED\n'],
    ])('does not qualify a zero-exit Cargo run with %s', (_label, stdout) => {
        spawn.mockImplementation((_command, args: string[]) => ({ status: 0, stdout: stdout.replace('{name}', args[3]), stderr: '' }));
        const results = runRustWindowEvidenceTests();
        expect(results).toHaveLength(2);
        expect(results.every((result: { passed: boolean }) => result.passed === false)).toBe(true);
    });

    test('requires the named test to pass even when other test executables run zero tests', () => {
        spawn.mockImplementation((_command, args: string[]) => ({ status: 0, stderr: '', stdout:
            `running 0 tests\ntest result: ok. 0 passed; 0 failed;\n\ntest tests::${args[3]} ... ok\n\ntest result: ok. 1 passed; 0 failed;\n` }));
        expect(runRustWindowEvidenceTests().every((result: { passed: boolean }) => result.passed)).toBe(true);
    });

    test('rejects a passing named test when Cargo later fails', () => {
        spawn.mockImplementation((_command, args: string[]) => ({ status: 101, stderr: 'later test executable failed', stdout: `test tests::${args[3]} ... ok\n` }));
        expect(runRustWindowEvidenceTests().every((result: { passed: boolean }) => result.passed === false)).toBe(true);
    });
});
