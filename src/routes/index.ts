import type { RouteEntry, ServerContext } from './types';
import { registerKnowledgeRoutes } from './knowledge';
import { registerNotemdRoutes } from './notemd';
import { registerMarkdownRoutes } from './markdown';
import { registerRenderRoutes } from './render';
import { registerSettingsRoutes } from './settings';
import { registerDiagnosticsRoutes } from './diagnostics';
import { registerDataRoutes } from './data';
import { registerAgentWorkspaceDiagnosticsRoutes } from './agentWorkspaceDiagnostics';

export type { RouteEntry, ServerContext } from './types';

export function registerAllRoutes(ctx: ServerContext): RouteEntry[] {
    return [
        ...registerKnowledgeRoutes(ctx),
        ...registerNotemdRoutes(ctx),
        ...registerMarkdownRoutes(ctx),
        ...registerRenderRoutes(ctx),
        ...registerSettingsRoutes(ctx),
        ...registerDiagnosticsRoutes(ctx),
        ...registerDataRoutes(ctx),
        ...registerAgentWorkspaceDiagnosticsRoutes(ctx),
    ];
}
