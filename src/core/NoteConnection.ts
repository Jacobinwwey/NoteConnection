import * as fs from 'fs';
import * as path from 'path';
import { FileLoader } from '../backend/FileLoader';
import { GraphBuilder } from '../backend/GraphBuilder';
import { config } from '../backend/config';
import { Graph } from './Graph';

export interface BuildOptions {
    targetPath?: string;
    maxWorkers?: number;
    enableGPU?: boolean;
    enableGPULayout?: boolean;
    memorySavingMode?: boolean;
    deepDebug?: boolean;
    projectRoot?: string; // Optional override for project root
    outputPrefix?: string; // Optional output filename prefix (e.g. for CLI run timestamps)
}

export interface GraphBuildResult {
    graph: Graph;
    data: any; // Serialized JSON data
    stats: {
        nodeCount: number;
        edgeCount: number;
        fileCount: number;
    };
}

/**
 * Core API for NoteConnection.
 * Decoupled from CLI/Server logic for easy integration into plugins (Joplin/Obsidian).
 */
export class NoteConnection {
    /**
     * Builds the knowledge graph from the specified source.
     * @param options Configuration options for the build process.
     * @returns Promise resolving to the built graph and its data.
     */
    static async build(options: BuildOptions): Promise<GraphBuildResult> {
        // 1. Configure Global Settings
        if (options.maxWorkers !== undefined) {
            console.log(`[Config] Setting maxWorkers to ${options.maxWorkers}`);
            config.maxWorkers = options.maxWorkers;
        }

        if (options.enableGPU !== undefined) {
            console.log(`[Config] Setting enableGPU to ${options.enableGPU}`);
            config.enableGPU = options.enableGPU;
        }

        if (options.enableGPULayout !== undefined) {
            console.log(`[Config] Setting enableGPULayout to ${options.enableGPULayout}`);
            config.enableGPULayout = options.enableGPULayout;
        }

        if (options.memorySavingMode !== undefined) {
            console.log(`[Config] Setting memorySavingMode to ${options.memorySavingMode}`);
            config.memorySavingMode = options.memorySavingMode;
        }

        if (options.deepDebug !== undefined) {
            console.log(`[Config] Setting deepDebug to ${options.deepDebug}`);
            config.deepDebug = options.deepDebug;
        }

        // 2. Resolve Directory
        const projectRoot = options.projectRoot || path.resolve(__dirname, '..', '..');
        const kbRoot = path.join(projectRoot, 'Knowledge_Base');
        
        let conceptDir: string;
        if (options.targetPath) {
            if (path.isAbsolute(options.targetPath)) {
                conceptDir = options.targetPath;
            } else {
                conceptDir = path.join(kbRoot, options.targetPath);
            }
        } else {
            conceptDir = kbRoot;
        }

        if (!fs.existsSync(conceptDir)) {
            throw new Error(`Directory not found: ${conceptDir}`);
        }

        // 3. Load Files
        console.log(`Loading files from: ${conceptDir}`);
        const files = await FileLoader.loadFiles(conceptDir);
        console.log(`Loaded ${files.length} files.`);

        // 4. Load Layout (Optional)
        // Note: Layout logic is slightly coupled to file system here, 
        // but it helps preserve state across builds.
        let layoutMap: Map<string, {x: number, y: number}> | undefined;
        const layoutPath = path.join(projectRoot, 'layout.json');
        
        if (fs.existsSync(layoutPath)) {
            console.log(`Found layout file: ${layoutPath}`);
            try {
                const rawLayout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
                if (Array.isArray(rawLayout)) {
                    layoutMap = new Map();
                    rawLayout.forEach((n: any) => {
                        if (n.id && typeof n.x === 'number' && typeof n.y === 'number') {
                            layoutMap!.set(n.id, { x: n.x, y: n.y });
                        }
                    });
                    console.log(`Loaded layout for ${layoutMap.size} nodes.`);
                }
            } catch (e) {
                console.warn('Failed to parse layout.json', e);
            }
        }

        // 5. Build Graph
        console.log('Building graph...');
        const graph = await GraphBuilder.build(files, layoutMap);
        const data = graph.toJSON();
        
        console.log(`Graph built: ${data.nodes.length} nodes, ${data.edges.length} edges.`);

        return {
            graph,
            data,
            stats: {
                nodeCount: data.nodes.length,
                edgeCount: data.edges.length,
                fileCount: files.length
            }
        };
    }
}
