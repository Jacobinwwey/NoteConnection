// src/backend/test_robustness.ts
import * as path from 'path';
import { FileLoader, NoteParser } from './parser';
import { GraphBuilder, Exporter } from './graph';

async function test() {
    const inputDir = path.resolve(__dirname, '../../test_robustness');
    const outputDir = path.resolve(__dirname, '../../test_robustness');
    const outputFile = path.join(outputDir, 'test_graph_result.json');

    console.log(`Starting Robustness Test...`);
    
    // 1. Load Files
    // 1. 加载文件
    const rawFiles = await FileLoader.loadFiles(inputDir);
    console.log(`Loaded ${rawFiles.length} files.`);

    // 2. Parse Concepts
    // 2. 解析概念
    const concepts = NoteParser.parse(rawFiles);
    
    // 3. Build Graph
    // 3. 构建图
    const graph = GraphBuilder.buildGraph(concepts);
    
    // 4. Export
    // 4. 导出
    await Exporter.exportToJSON(graph, outputFile);
    
    // 5. Validation Logic
    // 5. 验证逻辑
    console.log('--- Validation Report ---');
    
    // Check Node Count
    // 检查节点数量
    if (graph.nodes.length === 6) {
        console.log('[PASS] Node Count is 6');
    } else {
        console.error(`[FAIL] Node Count is ${graph.nodes.length}, expected 6`);
    }

    // Check Cycle A->B->C->A
    // 检查循环 A->B->C->A
    // Logic: Concept A mentions B -> Edge B->A (B is prerequisite for A)
    // 逻辑：概念 A 提到 B -> 边 B->A (B 是 A 的先决条件)
    // Concept B mentions C -> Edge C->B
    // Concept C mentions A -> Edge A->C
    // Cycle: A->C->B->A
    
    const hasEdge = (src: string, tgt: string) => 
        graph.edges.some(e => e.source === src && e.target === tgt);

    if (hasEdge('Concept B', 'Concept A')) console.log('[PASS] Edge B->A exists');
    else console.error('[FAIL] Edge B->A missing');

    if (hasEdge('Concept C', 'Concept B')) console.log('[PASS] Edge C->B exists');
    else console.error('[FAIL] Edge C->B missing');

    if (hasEdge('Concept A', 'Concept C')) console.log('[PASS] Edge A->C exists');
    else console.error('[FAIL] Edge A->C missing');

    // Check Special Char
    // 检查特殊字符
    // Special mentions A -> A->Special
    if (hasEdge('Concept A', 'Special (Char) Concept')) console.log('[PASS] Edge A->Special exists');
    else console.error('[FAIL] Edge A->Special missing');

    // Check Case Insensitivity
    // 检查不区分大小写
    // D mentions "concept a" -> A->D
    if (hasEdge('Concept A', 'Concept D')) console.log('[PASS] Edge A->D (Case Insensitive) exists');
    else console.error('[FAIL] Edge A->D missing');

    // Check Empty Concept
    // 检查空概念
    // Should be a node, but no edges connected to/from it (unless its name is common)
    // 应该是一个节点，但没有边连接到它/从它连接（除非它的名字很普通）
    const emptyNode = graph.nodes.find(n => n.id === 'Empty Concept');
    if (emptyNode) console.log('[PASS] Empty Concept node exists');
    else console.error('[FAIL] Empty Concept node missing');
}

test().catch(err => console.error(err));
