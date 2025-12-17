// src/backend/main.ts
import * as path from 'path';
import { FileLoader, NoteParser } from './parser';
import { GraphBuilder, Exporter } from './graph';

async function main() {
    const inputDir = path.resolve(__dirname, '../../testconcept');
    const outputDir = path.resolve(__dirname, '../frontend');
    const outputFile = path.join(outputDir, 'graph_data.json');

    console.log(`Starting Build Process...`);
    console.log(`Input Directory: ${inputDir}`);

    // 1. Load Files
    // 1. 加载文件
    const rawFiles = await FileLoader.loadFiles(inputDir);
    console.log(`Loaded ${rawFiles.length} files.`);

    if (rawFiles.length === 0) {
        console.warn('No markdown files found. Exiting.');
        return;
    }

    // 2. Parse Concepts
    // 2. 解析概念
    const concepts = NoteParser.parse(rawFiles);
    console.log(`Parsed ${concepts.length} concepts.`);

    // 3. Build Graph
    // 3. 构建图
    const graph = GraphBuilder.buildGraph(concepts);
    console.log(`Graph Built: ${graph.nodes.length} Nodes, ${graph.edges.length} Edges.`);

    // 4. Export
    // 4. 导出
    await Exporter.exportToJSON(graph, outputFile);
    console.log('Build Complete.');
}

main().catch(err => console.error(err));
