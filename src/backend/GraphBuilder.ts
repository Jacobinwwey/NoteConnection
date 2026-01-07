import { Graph } from '../core/Graph';
import { NoteNode } from '../core/types';
import { RawFile } from './FileLoader';
import { config } from './config';
import * as path from 'path';
import * as os from 'os';
import { Worker } from 'worker_threads';
import { CommunityDetection } from './CommunityDetection';
import { GraphMetrics } from './GraphMetrics';
import { isSimilar, checkMatch } from './utils/stringUtils';
import { FrontmatterParser } from './utils/frontmatterParser';
import { CycleDetector } from './algorithms/CycleDetection';
import { TopologicalSort } from './algorithms/TopologicalSort';
import { StatisticalAnalyzer } from './algorithms/StatisticalAnalyzer';
import { VectorSpace } from './algorithms/VectorSpace';
import { VectorSpaceGPU } from '../../amdgpu/VectorSpaceGPU';
import { HybridEngine } from './algorithms/HybridEngine';
import { PerformanceLogger } from './utils/PerformanceLogger';

/**
 * Service to build the graph from raw files.
 * 从原始文件构建图的服务。
 */
export class GraphBuilder {
  /**
   * Builds a graph from raw files using keyword matching.
   * 使用关键词匹配从原始文件构建图。
   * @param files Array of raw files | 原始文件数组
   * @param layout Optional map of saved node positions | 可选的保存节点位置映射
   */
  static async build(files: RawFile[], layout?: Map<string, {x: number, y: number}>): Promise<Graph> {
    PerformanceLogger.logSystemInfo();
    const graph = new Graph();

    // 1. Add all nodes first
    PerformanceLogger.start('Node Initialization');
    // 1. 首先添加所有节点
    const fileMap = new Map<string, RawFile>();
    files.forEach(file => {
      // Parse Metadata (Tags, Prerequisites, Next)
      const metadata = FrontmatterParser.parse(file.content);

      const node: NoteNode = {
        id: file.filename,
        label: file.filename,
        inDegree: 0,
        outDegree: 0,
        content: file.content,
        metadata: { 
            filepath: file.filepath, 
            tags: metadata.tags,
            prerequisites: metadata.prerequisites,
            next: metadata.next
        }
      };

      if (layout && layout.has(file.filename)) {
          const pos = layout.get(file.filename)!;
          node.x = pos.x;
          node.y = pos.y;
      }

      graph.addNode(node);
      fileMap.set(file.filename, file);

      // 1b. Add Tag Nodes
      if (config.enableTags) {
          metadata.tags.forEach(tag => {
              const tagId = `#${tag}`;
              if (!graph.hasNode(tagId)) {
                  graph.addNode({
                      id: tagId,
                      label: tagId,
                      inDegree: 0, outDegree: 0,
                      clusterId: 'tags' // Group tags together
                  });
              }
              // Edge: Note -> Tag
              graph.addEdge(node.id, tagId, 'tagged');
          });
      }
    });
    PerformanceLogger.end('Node Initialization');

    // 2. Identify edges
    PerformanceLogger.start('Edge Identification (Explicit)');
    
    // 2a. Explicit Dependencies (Frontmatter)
    // 2a. 显式依赖 (Frontmatter)
    files.forEach(sourceFile => {
        const sourceId = sourceFile.filename;
        const node = graph.getNode(sourceId);
        if (!node || !node.metadata) return;

        // Handle 'prerequisites': Target (Prereq) -> Source (Current)
        if (node.metadata.prerequisites && Array.isArray(node.metadata.prerequisites)) {
            node.metadata.prerequisites.forEach((prereq: string) => {
                let targetId = prereq;
                if (!graph.hasNode(targetId)) {
                    if (graph.hasNode(targetId + '.md')) {
                        targetId = targetId + '.md';
                    } else {
                        return; // Target not found
                    }
                }
                graph.addEdge(targetId, sourceId, 'explicit-prerequisite');
            });
        }

        // Handle 'next': Source (Current) -> Target (Next)
        if (node.metadata.next && Array.isArray(node.metadata.next)) {
            node.metadata.next.forEach((nextItem: string) => {
                 let targetId = nextItem;
                 if (!graph.hasNode(targetId)) {
                     if (graph.hasNode(targetId + '.md')) {
                         targetId = targetId + '.md';
                     }
                     else {
                         return;
                     }
                 }
                 graph.addEdge(sourceId, targetId, 'explicit-next');
            });
        }
    });
    PerformanceLogger.end('Edge Identification (Explicit)');

    // 2b. Keyword Matching Strategy
    // 2b. 关键词匹配策略
    PerformanceLogger.start('Keyword Matching');
    console.log(`[GraphBuilder] Starting keyword matching for ${files.length} files...`);
    if (files.length > 200) {
        // Use Parallel Processing
        console.log(`[GraphBuilder] Using Parallel Processing (Workers)`);
        await this.runParallelMatching(files, graph);
    } else {
        // Use Single Thread (Legacy)
        this.runSequentialMatching(files, graph);
    }
    PerformanceLogger.end('Keyword Matching');
    
    // 2c. Statistical Inference (v0.6.0)
    if (config.enableStatisticalInference) {
        PerformanceLogger.start('Statistical Inference');
        console.log('[GraphBuilder] Running Statistical Inference...');
        const terms = Array.from(fileMap.keys());
        const matrix = await StatisticalAnalyzer.analyzeAsync(files, terms);
        const inferredEdges = StatisticalAnalyzer.inferDependencies(matrix, 0.05, 0.1); 
        
        inferredEdges.forEach(dep => {
            graph.addEdge(dep.source, dep.target, 'statistical-inferred', dep.confidence);
        });
        console.log(`[GraphBuilder] Added ${inferredEdges.length} inferred edges.`);
        PerformanceLogger.end('Statistical Inference');
    }

    // 2d. Vector Similarity (v0.6.0)
    if (config.enableVectorSimilarity && !config.enableHybridInference) {
        PerformanceLogger.start('Vector Similarity');
        console.log('[GraphBuilder] Running Vector Similarity Analysis...');
        
        let vectorSpace: VectorSpace;
        if (config.enableGPU) {
             console.log('[GraphBuilder] Using GPU Acceleration for Vector Space...');
             vectorSpace = new VectorSpaceGPU(files);
        } else {
             vectorSpace = new VectorSpace(files);
        }

        let similarityEdges = 0;
        
        files.forEach(file => {
             const similar = vectorSpace.getSimilar(file.filename, 3); // Top 3 similar
             similar.forEach(sim => {
                 if (sim.score > 0.3) { // Threshold
                     // Add UNDIRECTED association
                     graph.addEdge(file.filename, sim.id, 'vector-association', sim.score);
                     similarityEdges++;
                 }
             });
        });
        
        if (vectorSpace instanceof VectorSpaceGPU) {
            vectorSpace.destroy();
        }
        
        console.log(`[GraphBuilder] Added ${similarityEdges} vector association edges.`);
        PerformanceLogger.end('Vector Similarity');
    }

    // 2e. Hybrid Inference (v0.7.0)
    if (config.enableHybridInference) {
        PerformanceLogger.start('Hybrid Inference');
        console.log('[GraphBuilder] Running Hybrid Inference (Stats + Vector)...');
        
        // Step 1: Stats Matrix
        PerformanceLogger.start('Hybrid: Stats Matrix');
        const terms = Array.from(fileMap.keys());
        const matrix = await StatisticalAnalyzer.analyzeAsync(files, terms);
        PerformanceLogger.end('Hybrid: Stats Matrix');

        // Step 2: Vector Space
        PerformanceLogger.start('Hybrid: Vector Space');
        let vectorSpace: VectorSpace;
        if (config.enableGPU) {
             console.log('[GraphBuilder] Using GPU Acceleration for Vector Space...');
             vectorSpace = new VectorSpaceGPU(files);
        } else {
             vectorSpace = new VectorSpace(files);
        }
        PerformanceLogger.end('Hybrid: Vector Space');

        // Step 3: Inference
        PerformanceLogger.start('Hybrid: Inference Engine');
        const hybridEdges = HybridEngine.infer(matrix, vectorSpace, 0.25, 0.1); // Tune thresholds
        PerformanceLogger.end('Hybrid: Inference Engine');
        
        hybridEdges.forEach(dep => {
             graph.addEdge(dep.source, dep.target, 'hybrid-inferred', dep.confidence);
             // Maybe add metadata/reason?
             // Graph edge types currently only store weight/type.
        });
        
        // Cleanup Memory Immediately
        console.log('[GraphBuilder] Cleaning up Hybrid Inference memory...');
        matrix.clear(); // Clear the massive stats matrix
        if (vectorSpace instanceof VectorSpaceGPU) {
            vectorSpace.destroy();
        }
        // @ts-ignore
        vectorSpace = null; // Drop reference

        console.log(`[GraphBuilder] Added ${hybridEdges.length} hybrid inferred edges.`);
        PerformanceLogger.end('Hybrid Inference');
    }

    // 3. Community Detection (v0.1.6) or Folder Clustering (v0.5.0)
    PerformanceLogger.start('Community Detection');
    if (config.clusteringStrategy === 'folder') {
        // Folder-based Clustering
        graph.getNodes().forEach(node => {
             // Skip special nodes like tags which might not have filepath
             if (node.clusterId === 'tags') return;
             
             if (node.metadata && node.metadata.filepath) {
                 const dirName = path.basename(path.dirname(node.metadata.filepath));
                 node.clusterId = dirName;
             } else {
                 node.clusterId = 'root'; // Fallback
             }
        });
    } else {
        // Label Propagation (Default)
        const clusters = CommunityDetection.detect(graph);
        clusters.forEach((clusterId, nodeId) => {
            const node = graph.getNode(nodeId);
            if (node) {
                // Don't overwrite special cluster IDs like 'tags'
                if (node.clusterId !== 'tags') {
                    node.clusterId = clusterId;
                }
            }
        });
    }
    PerformanceLogger.end('Community Detection');

    // 4. Graph Metrics (v0.1.7)
    PerformanceLogger.start('Graph Metrics');
    const centrality = GraphMetrics.calculateBetweenness(graph);
    centrality.forEach((val, nodeId) => {
        const node = graph.getNode(nodeId);
        if (node) {
            node.centrality = val;
        }
    });
    PerformanceLogger.end('Graph Metrics');

    // Free up memory before Algorithmic Core
    fileMap.clear();

    // 5. Algorithmic Core (v0.3.0)
    console.log('[GraphBuilder] Starting Algorithmic Core...');
    
    // Cycle Detection
    PerformanceLogger.start('Cycle Detection');
    console.log('[GraphBuilder] Running Cycle Detection...');
    // Limit to 100 cycles to prevent OOM on large graphs with many cycles
    const cycles = CycleDetector.detectCycles(graph, 100);
    if (cycles.length > 0) {
        const countStr = cycles.length >= 100 ? '100+' : cycles.length.toString();
        console.warn(`[GraphBuilder] Detected ${countStr} cycles. Topological Sort may be partial.`);
        // Note: We proceed anyway, but ranks might be inaccurate for cyclic nodes.
    }
    PerformanceLogger.end('Cycle Detection');

    // Topological Sort & Ranking
    PerformanceLogger.start('Topological Sort');
    console.log('[GraphBuilder] Running Topological Sort...');
    const ranks = TopologicalSort.assignRanks(graph);
    ranks.forEach((rank, nodeId) => {
        const node = graph.getNode(nodeId);
        if (node) {
            node.rank = rank;
        }
    });
    PerformanceLogger.end('Topological Sort');
    console.log('[GraphBuilder] Algorithmic Core Complete.');

    return graph;
  }

  // --- Parallel Execution Helpers ---

  private static async runParallelMatching(files: RawFile[], graph: Graph) {
      const numCPUs = os.cpus().length;
      // Allow user configuration or default to all cores minus 1 (min 1)
      const workerCount = config.maxWorkers ?? Math.max(1, numCPUs - 1);
      const chunkSize = Math.ceil(files.length / workerCount);
      const targetIds = files.map(f => f.filename);

      const workerPromises: Promise<void>[] = [];
      const workerPath = path.join(__dirname, 'workers', 'keywordMatchWorker.ts');
      
      // Check if we are in TS execution (ts-node) or JS (dist)
      // If extension is .ts, we assume ts-node.
      const isTsNode = path.extname(__filename) === '.ts';
      const actualWorkerPath = isTsNode 
        ? workerPath 
        : workerPath.replace('.ts', '.js');

      console.log(`[GraphBuilder] Worker Path: ${actualWorkerPath}`);
      console.log(`[GraphBuilder] isTsNode: ${isTsNode}`);
      console.log(`[GraphBuilder] Spawning ${workerCount} workers...`);

      for (let i = 0; i < workerCount; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, files.length);
          if (start >= files.length) break;

          const filesChunk = files.slice(start, end);
          const filePaths = filesChunk.map(f => f.filepath);

          const p = new Promise<void>((resolve, reject) => {
              try {
                  const execArgv = isTsNode ? ['-r', require.resolve('ts-node/register')] : undefined;
                  const worker = new Worker(actualWorkerPath, {
                      workerData: {
                          filePaths,
                          targetIds,
                          strategy: config.matchingStrategy,
                          exclusionList: config.exclusionList
                      },
                      execArgv
                  });

                  worker.on('message', (results: {source: string, target: string}[]) => {
                      results.forEach(res => {
                          graph.addEdge(res.target, res.source, 'keyword-match');
                      });
                  });

                  worker.on('error', (err) => {
                      console.error(`[GraphBuilder] Worker error:`, err);
                      reject(err);
                  });
                  
                  worker.on('exit', (code) => {
                      if (code !== 0) {
                          console.error(`[GraphBuilder] Worker exited with code ${code}`);
                          reject(new Error(`Worker stopped with exit code ${code}`));
                      } else {
                          resolve();
                      }
                  });
              } catch (e) {
                  console.error(`[GraphBuilder] Failed to spawn worker:`, e);
                  reject(e);
              }
          });
          workerPromises.push(p);
      }

      try {
        await Promise.all(workerPromises);
        console.log(`[GraphBuilder] Parallel matching complete.`);
      } catch (err) {
          console.error('[GraphBuilder] Parallel matching failed, falling back to sequential.', err);
          // Fallback
          this.runSequentialMatching(files, graph);
      }
  }

  private static runSequentialMatching(files: RawFile[], graph: Graph) {
      files.forEach(sourceFile => {
        const sourceId = sourceFile.filename;
        const content = sourceFile.content;
  
        files.forEach(targetFile => {
          const targetId = targetFile.filename;
          if (sourceId === targetId) return; // Skip self | 跳过自身
  
          // Exclusion Check
          if (config.exclusionList.includes(targetId)) {
              return;
          }
  
          if (checkMatch(content, targetId, config.matchingStrategy)) {
               // Found a reference!
               // Target (Concept) -> Source (Context)
               graph.addEdge(targetId, sourceId, 'keyword-match');
          }
        });
      });
  }
}