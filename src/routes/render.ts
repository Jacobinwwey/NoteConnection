/**
 * Render routes: Math, Mermaid, Graphviz and clipboard operations.
 * Uses dynamic import() to avoid tsc resolution issues with jsdom-dependent modules.
 */
import type { RouteEntry, ServerContext } from './types';

const isPngBuffer = (value: Buffer): boolean =>
    value.length >= 8
    && value[0] === 0x89
    && value[1] === 0x50
    && value[2] === 0x4e
    && value[3] === 0x47
    && value[4] === 0x0d
    && value[5] === 0x0a
    && value[6] === 0x1a
    && value[7] === 0x0a;
import { CrashLogger } from '../backend/utils/CrashLogger';
import { resolveRenderMaterializationDecision } from '../platform/RenderMaterializer';

type MermaidRendererPreference = 'auto' | 'local' | 'frontend';

function normalizeMermaidRendererPreference(value: unknown): MermaidRendererPreference {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'local') {
        return 'local';
    }
    if (normalized === 'frontend' || normalized === 'bridge') {
        return 'frontend';
    }
    return 'auto';
}

export function registerRenderRoutes(ctx: ServerContext): RouteEntry[] {
    const json = (res: any, code: number, data: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    const fail = (res: any, error: unknown, label: string) => {
        console.error(error);
        CrashLogger.log(error, label);
        json(res, 500, { success: false, error: String(error) });
    };

    const readBody = (req: any): Promise<string> =>
        new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            req.on('error', reject);
        });

    const parseOptionalPositiveDimension = (value: unknown): number | undefined => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return undefined;
        }
        return Math.floor(numeric);
    };

    const parseOptionalPositiveScale = (value: unknown): number | undefined => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return undefined;
        }
        return numeric;
    };

    const renderMermaidWithPreference = async (
        source: string,
        options: {
            rendererPreference: MermaidRendererPreference;
            includeStages: boolean;
            includeSvg: boolean;
            maxWidth?: number;
            maxHeight?: number;
            renderScale?: number;
        }
    ): Promise<Record<string, unknown>> => {
        const includeSvg = options.includeStages || options.includeSvg;
        const { normalizeMermaidDefinition } = await import('../reader_renderer');
        const normalizedSource = normalizeMermaidDefinition(source);
        const pathBridge = typeof ctx.getPathBridge === 'function' ? ctx.getPathBridge() : null;

        if (
            options.rendererPreference !== 'local'
            && pathBridge
            && typeof pathBridge.requestFrontendMermaidRender === 'function'
        ) {
            try {
                const frontendRendered = await pathBridge.requestFrontendMermaidRender({
                    source,
                    theme: 'dark',
                    maxWidth: options.maxWidth,
                    maxHeight: options.maxHeight,
                    renderScale: options.renderScale,
                    includeStages: options.includeStages,
                    includeSvg,
                });
                const frontendResult: Record<string, unknown> = {
                    pngBase64: frontendRendered.pngBase64,
                    width: frontendRendered.width,
                    height: frontendRendered.height,
                    renderer: frontendRendered.renderer || 'frontend-bridge',
                    normalizedSource,
                };
                if (includeSvg && typeof frontendRendered.svg === 'string' && frontendRendered.svg.trim()) {
                    frontendResult.svg = frontendRendered.svg;
                }
                if (options.includeStages && Array.isArray(frontendRendered.stages)) {
                    frontendResult.stages = frontendRendered.stages;
                }
                return frontendResult;
            } catch (error) {
                if (options.rendererPreference === 'frontend') {
                    throw error;
                }
                console.warn('[Render Route] Frontend Mermaid renderer unavailable, falling back to local resvg.', error);
            }
        }

        const {
            collectMermaidRenderStageSnapshots,
            renderMermaidPng,
        } = await import('../reader_renderer');
        const localRendered = await renderMermaidPng(source, {
            theme: 'dark',
            maxWidth: options.maxWidth,
            maxHeight: options.maxHeight,
            renderScale: options.renderScale,
        });
        const localResult: Record<string, unknown> = {
            pngBase64: localRendered.pngBase64,
            width: localRendered.width,
            height: localRendered.height,
            renderer: 'local-resvg',
            normalizedSource,
        };
        if (includeSvg && typeof localRendered.svg === 'string' && localRendered.svg.trim()) {
            localResult.svg = localRendered.svg;
        }
        if (options.includeStages) {
            localResult.stages = await collectMermaidRenderStageSnapshots(source, {
                theme: 'dark',
                maxWidth: options.maxWidth,
                maxHeight: options.maxHeight,
                renderScale: options.renderScale,
            });
        }
        return localResult;
    };

    return [
        {
            method: 'POST',
            path: '/api/render/math',
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    const expression = typeof payload?.expression === 'string'
                        ? payload.expression
                        : (typeof payload?.source === 'string' ? payload.source : '');
                    if (!expression.trim()) {
                        const hasExpressionField = Object.prototype.hasOwnProperty.call(payload || {}, 'expression');
                        json(res, 400, hasExpressionField
                            ? { success: false, error: 'Missing expression' }
                            : { error: 'Missing source' });
                        return;
                    }
                    const { renderMathPng } = await import('../reader_renderer');
                    const result = await renderMathPng(expression, {
                        displayMode: payload?.displayMode !== false,
                        maxWidth: parseOptionalPositiveDimension(payload?.maxWidth),
                        maxHeight: parseOptionalPositiveDimension(payload?.maxHeight),
                        renderScale: parseOptionalPositiveScale(payload?.renderScale),
                    });
                    const materialization = resolveRenderMaterializationDecision({
                        exportProfileId: payload?.exportProfileId,
                        platformTarget: payload?.platformTarget,
                    });
                    json(res, 200, {
                        success: true,
                        pngBase64: result.pngBase64,
                        width: result.width,
                        height: result.height,
                        materialization,
                    });
                } catch (e) { fail(res, e, 'POST /api/render/math'); }
            },
        },
        {
            method: 'POST',
            path: '/api/render/mermaid',
            handler: async (req, res) => {
                let source = '';
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    source = typeof payload?.source === 'string'
                        ? payload.source
                        : (typeof payload?.diagram === 'string' ? payload.diagram : '');
                    if (!source.trim()) {
                        json(res, 400, { error: 'Missing source' });
                        return;
                    }

                    const includeStages = payload?.includeStages === true;
                    const materialization = resolveRenderMaterializationDecision({
                        exportProfileId: payload?.exportProfileId,
                        platformTarget: payload?.platformTarget,
                        includeSvg: payload?.includeSvg === true,
                        includeStages,
                        rendererPreference: payload?.renderer,
                    });
                    const rendererPreference = normalizeMermaidRendererPreference(materialization.rendererPreference);
                    const responsePayload = await renderMermaidWithPreference(source, {
                        rendererPreference,
                        includeStages: materialization.includeStages,
                        includeSvg: materialization.includeSvg,
                        maxWidth: parseOptionalPositiveDimension(payload?.maxWidth),
                        maxHeight: parseOptionalPositiveDimension(payload?.maxHeight),
                        renderScale: parseOptionalPositiveScale(payload?.renderScale),
                    });
                    responsePayload.materialization = materialization;
                    json(res, 200, responsePayload);
                } catch (e) {
                    try {
                        const { normalizeMermaidDefinition } = await import('../reader_renderer');
                        json(res, 500, {
                            success: false,
                            error: String(e),
                            normalizedSource: normalizeMermaidDefinition(source),
                        });
                    } catch {
                        fail(res, e, 'POST /api/render/mermaid');
                    }
                }
            },
        },
        {
            method: 'POST',
            path: '/api/render/graphviz',
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    const source = typeof payload?.source === 'string' ? payload.source : '';
                    if (!source.trim()) {
                        json(res, 400, { error: 'Missing source' });
                        return;
                    }
                    json(res, 200, { success: true, message: 'graphviz render route' });
                } catch (e) { fail(res, e, 'POST /api/render/graphviz'); }
            },
        },
        {
            method: 'POST',
            path: '/api/clipboard/image',
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const { pngBase64 } = JSON.parse(body);
                    const normalizedPngBase64 = typeof pngBase64 === 'string' ? pngBase64.trim() : '';
                    if (!normalizedPngBase64) {
                        json(res, 400, { error: 'Missing pngBase64' });
                        return;
                    }
                    const { copyPngToClipboard } = await import('../native_clipboard');
                    const pngBuffer = Buffer.from(normalizedPngBase64, 'base64');
                    if (!isPngBuffer(pngBuffer)) {
                        json(res, 400, { error: 'Invalid PNG payload' });
                        return;
                    }
                    await copyPngToClipboard(pngBuffer);
                    json(res, 200, { ok: true });
                } catch (e) { fail(res, e, 'POST /api/clipboard/image'); }
            },
        },
        {
            method: 'POST',
            path: '/api/clipboard/image-binary',
            handler: async (req, res) => {
                try {
                    const chunks: Buffer[] = [];
                    req.on('data', (c: Buffer) => chunks.push(c));
                    await new Promise<void>((resolve, reject) => {
                        req.on('end', resolve);
                        req.on('error', reject);
                    });
                    const pngBuffer = Buffer.concat(chunks);
                    if (!isPngBuffer(pngBuffer)) {
                        json(res, 400, { error: 'Invalid PNG payload' });
                        return;
                    }
                    const { copyPngToClipboard } = await import('../native_clipboard');
                    await copyPngToClipboard(pngBuffer);
                    json(res, 200, { ok: true });
                } catch (e) { fail(res, e, 'POST /api/clipboard/image-binary'); }
            },
        },
    ];
}
