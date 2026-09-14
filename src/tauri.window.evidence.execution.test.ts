import { spawnSync } from 'child_process';

jest.mock('child_process', () => ({ ...jest.requireActual('child_process'), spawnSync: jest.fn() }));

const { runRustWindowEvidenceTests } = require('../scripts/verify-agent-workspace-tauri-window-evidence');
const { runRustContractTests } = require('../scripts/verify-agent-workspace-tauri-rust');
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

    test('selects the native window feature and library target in separate Cargo processes', () => {
        spawn.mockReturnValue({ status: 0, stdout: '', stderr: '' });
        runRustWindowEvidenceTests();
        expect(spawn).toHaveBeenCalledTimes(2);
        for (const [command, args] of spawn.mock.calls) {
            expect(command).toBe('cargo');
            expect(args).toEqual(expect.arrayContaining(['--lib', '--locked', '--features', 'native-window-tests', '--ignored', '--show-output']));
        }
    });
});

describe('ordinary Rust contract execution evidence', () => {
    afterEach(() => jest.clearAllMocks());

    const names = [
        'pathmode_window_toggle_plan_decouples_godot_signal_from_tauri_hide_restore_flags',
        'pathmode_window_toggle_plan_restores_tauri_focus_when_restore_policy_is_enabled',
        'pathmode_window_toggled_event_payload_contains_config_and_execution_plan',
    ];

    test.each([
        ['empty selection', 0, 'running 0 tests\ntest result: ok. 0 passed; 0 failed;', ''],
        ['unrelated passing test', 0, 'test tests::unrelated ... ok', ''],
        ['ignored tests', 0, names.map(name => `test tests::${name} ... ignored`).join('\n'), ''],
        ['failed Cargo invocation mentioning zero tests', 101, '', '0 tests matched after failure'],
    ])('does not qualify %s', (_label, status, stdout, stderr) => {
        spawn.mockReturnValue({ status, stdout, stderr });
        const results = runRustContractTests();
        expect(results.every((result: { passed: boolean }) => result.passed === false)).toBe(true);
        expect(results.every((result: { exitCode: number }) => result.exitCode === status)).toBe(true);
    });

    test('requires every named case, including both toggle policy tests', () => {
        spawn.mockReturnValue({ status: 0, stdout: `test tests::${names[0]} ... ok\n`, stderr: '' });
        expect(runRustContractTests().every((result: { passed: boolean }) => result.passed === false)).toBe(true);
    });

    test('qualifies executed names and preserves a later Cargo failure', () => {
        const stdout = names.map(name => `test tests::${name} ... ok`).join('\n');
        spawn.mockReturnValue({ status: 0, stdout, stderr: '' });
        expect(runRustContractTests().every((result: { passed: boolean }) => result.passed)).toBe(true);
        spawn.mockReturnValue({ status: 101, stdout, stderr: 'process failed' });
        expect(runRustContractTests().every((result: { passed: boolean }) => result.passed === false)).toBe(true);
    });
});
