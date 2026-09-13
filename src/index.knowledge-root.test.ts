import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildGraph } from './index';
import { config } from './backend/config';
import { NoteConnection } from './core/NoteConnection';

describe('Graph builds in the selected knowledge workspace', () => {
    const environmentKeys = [
        'NOTE_CONNECTION_PROJECT_ROOT',
        'NOTE_CONNECTION_KB_ROOT',
        'NOTE_CONNECTION_FRONTEND_DIR',
        'NOTE_CONNECTION_RUNTIME_DATA_DIR',
    ];
    const originalConfig = { ...config, exclusionList: [...config.exclusionList] };
    let previousEnvironment: Array<string | undefined>;
    let fixtureRoot: string;
    let projectRoot: string;
    let selectedRoot: string;

    beforeEach(() => {
        previousEnvironment = environmentKeys.map(key => process.env[key]);
        fixtureRoot = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-selected-kb-')));
        projectRoot = path.join(fixtureRoot, 'application');
        selectedRoot = path.join(fixtureRoot, 'selected-vault');
        const frontendRoot = path.join(projectRoot, 'dist', 'src', 'frontend');
        const runtimeRoot = path.join(fixtureRoot, 'runtime-data');
        for (const directory of [path.join(projectRoot, 'Knowledge_Base'), path.join(selectedRoot, 'notes'), frontendRoot, runtimeRoot]) {
            fs.mkdirSync(directory, { recursive: true });
        }
        fs.writeFileSync(path.join(projectRoot, 'Knowledge_Base', 'Default.md'), '# Default\nThis is a different workspace.');
        fs.writeFileSync(path.join(selectedRoot, 'notes', 'Alpha.md'), '# Alpha\nAlpha requires [[Beta]].');
        fs.writeFileSync(path.join(selectedRoot, 'notes', 'Beta.md'), '# Beta\nBeta is the prerequisite foundation.');
        [projectRoot, selectedRoot, frontendRoot, runtimeRoot].forEach((directory, index) => {
            process.env[environmentKeys[index]] = directory;
        });
        Object.assign(config, {
            enableTags: false,
            enableStatisticalInference: false,
            enableVectorSimilarity: false,
            enableHybridInference: false,
            enableGPU: false,
            enableGPULayout: false,
            clusteringStrategy: 'folder',
            maxWorkers: 1,
            exclusionList: [],
        });
    });

    afterEach(() => {
        environmentKeys.forEach((key, index) => {
            const previous = previousEnvironment[index];
            if (previous === undefined) delete process.env[key];
            else process.env[key] = previous;
        });
        Object.assign(config, originalConfig);
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    });

    test('builds an absolute native target with identities relative to the selected workspace', async () => {
        const graph = await buildGraph({ targetPath: path.join(selectedRoot, 'notes') });
        expect(graph.nodes.map((node: { id: string }) => node.id).sort()).toEqual(['Alpha', 'Beta']);
        expect(graph.nodes.find((node: { id: string }) => node.id === 'Alpha')).toEqual(expect.objectContaining({
            canonicalId: 'notes/alpha',
            sourceUri: 'note://workspace/v1/notes/alpha.md',
        }));
    });

    test('resolves a relative CLI target against the selected workspace', async () => {
        const graph = await buildGraph('notes');
        expect(graph.nodes.map((node: { canonicalId: string }) => node.canonicalId).sort()).toEqual(['notes/alpha', 'notes/beta']);
    });

    test('builds the entire selected workspace without reading the application default', async () => {
        const graph = await buildGraph({});
        expect(graph.nodes.map((node: { id: string }) => node.id).sort()).toEqual(['Alpha', 'Beta']);
    });

    test('preserves the direct library default independently of runtime environment overrides', async () => {
        const result = await NoteConnection.build({ projectRoot });
        expect(result.data.nodes.map((node: { id: string }) => node.id)).toEqual(['Default']);
    });

    test('accepts an explicit library knowledge root without moving the application root', async () => {
        const result = await NoteConnection.build({ projectRoot, knowledgeBaseRoot: selectedRoot, targetPath: 'notes' });
        expect(result.stats.fileCount).toBe(2);
        expect(result.data.nodes.map((node: { canonicalId: string }) => node.canonicalId).sort()).toEqual(['notes/alpha', 'notes/beta']);
    });
});
