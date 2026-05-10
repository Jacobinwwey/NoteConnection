/**
 * Settings routes: Frontend, Path Mode, and other configuration endpoints.
 * Currently no routes extracted — frontend/path-mode settings remain in
 * server.ts inline chain (require loadFrontendSettings/loadPathModeSettings
 * which are not yet exposed through ServerContext).
 */
import type { RouteEntry, ServerContext } from './types';

export function registerSettingsRoutes(_ctx: ServerContext): RouteEntry[] {
    return [];
}
