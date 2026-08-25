import { defineConfig } from 'vite';
import { resolve } from 'path';

const frontendDir = resolve(__dirname, 'src', 'frontend');
// Vite validates the module graph. The runtime frontend remains the build-owned
// legacy-compatible directory consumed by Tauri and mobile staging.
const viteVerificationDir = resolve(__dirname, 'dist', 'vite-verify');

export default defineConfig({
    root: frontendDir,
    base: './',
    build: {
        outDir: viteVerificationDir,
        emptyOutDir: true,
        target: 'es2020',
        modulePreload: false,
        rollupOptions: {
            input: {
                main: resolve(frontendDir, 'index.html'),
                path: resolve(frontendDir, 'path.html'),
                notemd: resolve(frontendDir, 'notemd.html'),
                help: resolve(frontendDir, 'help.html'),
                manual: resolve(frontendDir, 'manual.html'),
            },
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) return 'vendor';
                    if (id.includes('/libs/')) return 'vendor-libs';
                    if (id.includes('path_worker_bridge') || id.includes('workbench_state')) return 'path-workbench';
                    if (id.includes('path_worker') && !id.includes('bridge')) return 'path-worker';
                    if (id.includes('path_app')) return 'path-mode';
                    if (id.includes('workspace_panes') || id.includes('agent_workspace')) return 'agent-workspace';
                    if (id.includes('graph_state')) return 'graph-state';
                    if (id.includes('app.js') || id.includes('source_manager')) return 'graph-app';
                },
            },
        },
        minify: 'esbuild',
        sourcemap: false,
    },
    resolve: {
        alias: {
            '@frontend': frontendDir,
            '@libs': resolve(frontendDir, 'libs'),
            '@locales': resolve(frontendDir, 'locales'),
        },
    },
    worker: {
        format: 'es',
    },
    css: {
        devSourcemap: false,
    },
    server: {
        port: 5173,
        strictPort: false,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://127.0.0.1:9876',
                ws: true,
            },
        },
    },
});
