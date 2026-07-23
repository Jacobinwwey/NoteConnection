import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildGraph } from '../index';
import { registerDataRoutes } from './data';

jest.mock('../index', () => ({
    buildGraph: jest.fn().mockResolvedValue(undefined),
}));

function createJsonRequest(payload: unknown): EventEmitter & { url: string } {
    const request = new EventEmitter() as EventEmitter & { url: string };
    request.url = '/api/build';
    setImmediate(() => {
        request.emit('data', Buffer.from(JSON.stringify(payload), 'utf8'));
        request.emit('end');
    });
    return request;
}

function createJsonResponse(): {
    response: { writeHead: jest.Mock; end: jest.Mock };
    completed: Promise<{ status: number; body: any }>;
} {
    let status = 0;
    let complete: (value: { status: number; body: any }) => void = () => undefined;
    const completed = new Promise<{ status: number; body: any }>((resolve) => {
        complete = resolve;
    });
    const response = {
        writeHead: jest.fn((nextStatus: number) => {
            status = nextStatus;
        }),
        end: jest.fn((body: string) => {
            complete({ status, body: JSON.parse(body) });
        }),
    };
    return { response, completed };
}

describe('data route relation recompute mode', () => {
    let workspaceRoot: string;
    let kbRoot: string;
    let runtimeDataDir: string;
    let ingestKnowledge: jest.Mock;

    beforeEach(async () => {
        workspaceRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'noteconnection-data-route-'));
        kbRoot = path.join(workspaceRoot, 'Knowledge_Base');
        runtimeDataDir = path.join(workspaceRoot, 'runtime');
        await fs.promises.mkdir(path.join(kbRoot, 'sample'), { recursive: true });
        await fs.promises.writeFile(
            path.join(kbRoot, 'sample', 'evidence.md'),
            '# Evidence\n\nA direct support claim.',
            'utf8',
        );
        ingestKnowledge = jest.fn().mockResolvedValue({
            summary: {
                changedDocuments: 1,
                resolvedRelationRecomputeMode: 'incremental',
            },
        });
        jest.mocked(buildGraph).mockClear();
    });

    afterEach(async () => {
        await fs.promises.rm(workspaceRoot, { recursive: true, force: true });
    });

    async function postBuild(payload: unknown): Promise<{ status: number; body: any }> {
        const routes = registerDataRoutes({
            LOOPBACK_HOST: '127.0.0.1',
            finalPort: 3000,
            kbRoot,
            runtimeDataDir,
            knowledgeLearningPlatform: { ingestKnowledge },
        } as any);
        const route = routes.find((entry) => entry.method === 'POST' && entry.path === '/api/build');
        if (!route) {
            throw new Error('POST /api/build route missing');
        }
        const request = createJsonRequest(payload);
        const { response, completed } = createJsonResponse();
        await route.handler(request as any, response as any, undefined as any);
        return completed;
    }

    test('keeps incremental relation recompute as the product default', async () => {
        const result = await postBuild({ target: 'sample' });

        expect(result.status).toBe(200);
        expect(ingestKnowledge).toHaveBeenCalledWith(expect.objectContaining({
            relationRecomputeMode: 'incremental',
        }));
    });

    test('allows the runtime verifier to disable dynamic relation recompute explicitly', async () => {
        const result = await postBuild({ target: 'sample', relationRecomputeMode: 'none' });

        expect(result.status).toBe(200);
        expect(ingestKnowledge).toHaveBeenCalledWith(expect.objectContaining({
            relationRecomputeMode: 'none',
        }));
    });

    test('rejects unsupported modes before graph construction', async () => {
        const result = await postBuild({ target: 'sample', relationRecomputeMode: 'auto' });

        expect(result.status).toBe(400);
        expect(result.body.error).toContain('none, incremental, full');
        expect(buildGraph).not.toHaveBeenCalled();
        expect(ingestKnowledge).not.toHaveBeenCalled();
    });
});
