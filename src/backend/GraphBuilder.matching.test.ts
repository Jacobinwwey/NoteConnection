import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GraphBuilder } from './GraphBuilder';
import { config } from './config';
import type { RawFile } from './FileLoader';
import { checkMatch } from './utils/stringUtils';

describe('graph keyword matching equivalence', () => {
    const original = { ...config, exclusionList: [...config.exclusionList] };
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-matching-'));
        Object.assign(config, {
            enableTags: false, enableStatisticalInference: false, enableVectorSimilarity: false,
            enableHybridInference: false, enableGPU: false, enableGPULayout: false,
            clusteringStrategy: 'folder', exclusionList: ['ignored'], maxWorkers: 1,
        });
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        Object.assign(config, original);
        jest.restoreAllMocks();
        fs.rmSync(root, { recursive: true, force: true });
    });

    function corpus(): RawFile[] {
        const records = [
            ['cat', ''], ['知识', ''], ['Alpha', ''], ['++', ''], ['café', ''],
            ['ignored', ''], ['self', 'self'],
            ['english-context', 'concatenate'], ['chinese-context', '知识图谱'],
            ['mixed-context', 'Alpha知识'], ['punctuation-context', 'a++b'],
            ['unicode-context', 'précaféiné'], ['excluded-context', 'ignored'],
        ];
        return records.map(([filename, content]) => {
            const filepath = path.join(root, filename + '.md');
            fs.writeFileSync(filepath, content);
            return { filename, filepath, content };
        });
    }

    function expectedEdges(files: RawFile[]): string[] {
        return files.flatMap(source => files
            .filter(target => source.filename !== target.filename
                && !config.exclusionList.includes(target.filename)
                && checkMatch(source.content, target.filename, config.matchingStrategy))
            .map(target => target.filename + '->' + source.filename)).sort();
    }

    test.each(['exact-phrase', 'fuzzy'] as const)('sequential matching preserves %s semantics', async strategy => {
        config.matchingStrategy = strategy;
        const files = corpus();
        const graph = await GraphBuilder.build(files);
        expect(graph.getEdges().filter(edge => edge.type === 'keyword-match')
            .map(edge => edge.source + '->' + edge.target).sort()).toEqual(expectedEdges(files));
    });

    test.each([true, false])('worker matching preserves fuzzy semantics with memorySavingMode=%s', async memorySavingMode => {
        config.matchingStrategy = 'fuzzy';
        config.memorySavingMode = memorySavingMode;
        const files = corpus();
        for (let index = 0; files.length <= 200; index++) {
            const filename = 'unused-' + index;
            const filepath = path.join(root, filename + '.md');
            fs.writeFileSync(filepath, '');
            files.push({ filename, filepath, content: '' });
        }
        const graph = await GraphBuilder.build(files);
        expect(graph.getEdges().filter(edge => edge.type === 'keyword-match')
            .map(edge => edge.source + '->' + edge.target).sort()).toEqual(expectedEdges(files));
    }, 30_000);
});

