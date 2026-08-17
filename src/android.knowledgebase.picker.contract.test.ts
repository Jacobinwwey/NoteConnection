import * as fs from 'fs';
import * as path from 'path';

describe('Android knowledge-base picker contract', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const templatePath = path.join(repoRoot, 'src-tauri', 'mobile', 'android', 'KnowledgeBasePickerBridge.kt');
    const patcherPath = path.join(repoRoot, 'scripts', 'apply-tauri-android-pathmode.js');
    const rustPath = path.join(repoRoot, 'src-tauri', 'src', 'lib.rs');
    const sourceManagerPath = path.join(repoRoot, 'src', 'frontend', 'source_manager.js');

    test('uses SAF tree permissions and bounded app-local streaming import', () => {
        const template = fs.readFileSync(templatePath, 'utf8');
        expect(template).toContain('ACTION_OPEN_DOCUMENT_TREE');
        expect(template).toContain('FLAG_GRANT_PERSISTABLE_URI_PERMISSION');
        expect(template).toContain('takePersistableUriPermission');
        expect(template).toContain('context.filesDir, "Knowledge_Base"');
        expect(template).toContain('MAX_DOCUMENT_BYTES');
        expect(template).toContain('MAX_TOTAL_BYTES');
        expect(template).toContain('input.copyTo(output, 32 * 1024)');
        expect(template).toContain('replaceImportedTree');
        expect(template).toContain('Duplicate import path');
        expect(template).toContain('knowledge_base_import_journal.v1.json');
        expect(template).toContain('recoverImportTransaction(activity.applicationContext)');
        expect(template).toContain('target-backed-up');
        expect(template).toContain('target-activated');
        expect(template).toContain('invalid_import_journal');
        expect(template).toContain('output.fd.sync()');
        expect(template).toContain('isSafeTransactionPath');
        expect(template).toContain('isKnownJournalPhase');
        expect(template).toContain('recovered_previous');
        expect(template).toContain('importInFlight');
        expect(template).toContain('import_in_progress');
        expect(template).toContain('synchronized(importLock)');
        expect(template).not.toContain('readText()');
    });

    test('patches picker bridge into mobile-slim without enabling Godot', () => {
        const patcher = fs.readFileSync(patcherPath, 'utf8');
        expect(patcher).toContain('KnowledgeBasePickerBridge.kt');
        expect(patcher).toContain('patchKnowledgeBasePicker');
        expect(patcher).toContain('KnowledgeBasePickerBridge.bindActivity(this)');
        expect(patcher).toContain('removePathmodeAssets');
    });

    test('exposes additive request/poll commands and enables the Android capability', () => {
        const rust = fs.readFileSync(rustPath, 'utf8');
        const sourceManager = fs.readFileSync(sourceManagerPath, 'utf8');
        expect(rust).toContain('request_android_knowledge_base_picker');
        expect(rust).toContain('consume_android_knowledge_base_picker_result');
        expect(rust).toContain('kb_import_mode: "android-saf-copy"');
        expect(sourceManager).toContain("request_kb_path_change");
        expect(sourceManager).toContain("poll_kb_path_change");
        expect(sourceManager).toContain('Timed out waiting for Android knowledge base import.');
    });

    test('keeps Android slim packaging size-first and clears stale generated outputs', () => {
        const runner = fs.readFileSync(
            path.join(repoRoot, 'scripts', 'run-tauri-android.js'),
            'utf8'
        );
        expect(runner).toContain("CARGO_PROFILE_RELEASE_OPT_LEVEL || 'z'");
        expect(runner).toContain('CARGO_PROFILE_RELEASE_CODEGEN_UNITS, 1');
        expect(runner).toContain("CARGO_PROFILE_RELEASE_LTO || 'thin'");
        expect(runner).toContain('cleanAndroidSlimOutputs');
        expect(runner).toContain('!includeGodotPathmode');
    });
});
