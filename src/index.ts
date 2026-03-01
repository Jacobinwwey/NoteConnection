import * as path from 'path';
import * as fs from 'fs';
import { NoteConnection, BuildOptions } from './core/NoteConnection';
import { resolveRuntimePaths } from './utils/RuntimePaths';

export async function buildGraph(options: BuildOptions | string, maxWorkers?: number, enableGPU?: boolean, enableGPULayout?: boolean, memorySavingMode?: boolean, deepDebug?: boolean) {
  const runtimePaths = resolveRuntimePaths(__dirname);
  const projectRoot = runtimePaths.projectRoot;
  const frontendDir = runtimePaths.frontendDir;
  
  let buildOptions: BuildOptions = { projectRoot };

  if (typeof options === 'string') {
      // Legacy signature support
      buildOptions.targetPath = options;
      buildOptions.maxWorkers = maxWorkers;
      buildOptions.enableGPU = enableGPU;
      buildOptions.enableGPULayout = enableGPULayout;
      buildOptions.memorySavingMode = memorySavingMode;
      buildOptions.deepDebug = deepDebug;
  } else {
      // New object signature
      buildOptions = { ...options, projectRoot };
      
      // Map frontend 'target' to backend 'targetPath'
      // Frontend uses 'target', BuildOptions interface expects 'targetPath'
      if ((options as any).target && !buildOptions.targetPath) {
          const target = (options as any).target;
          // Handle 'ALL_FOLDERS' special case
          if (target !== 'ALL_FOLDERS') {
              buildOptions.targetPath = target;
          }
          // If 'ALL_FOLDERS', targetPath remains undefined, which means load entire kbRoot
      }
  }
  
  const result = await NoteConnection.build(buildOptions);

  const data = result.data;

  // File Output Logic (CLI/Server Specific)
  const outputPath = path.join(frontendDir, 'graph_data.json');
  
  // Ensure frontend directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Optimization: Create a "Lite" version for frontend initial load (data.js)
  // Exclude 'content' to drastically reduce file size and parsing time.
  const liteData = {
      nodes: data.nodes.map((n: any) => {
          // Destructure to exclude content, keep everything else including metadata
          const { content, ...rest } = n;
          return rest;
      }),
      edges: data.edges
  };

  // Logic:
  // If running from CLI (outputPrefix is set):
  // 1. Do NOT touch original 'graph_data.json' or 'data.js'.
  // 2. Save as 'graph_data_cli_{time}.json' and 'data_cli_{time}.js'.
  
  if (buildOptions.outputPrefix) {
      // CLI Mode
      const timestampedPath = path.join(frontendDir, `graph_data_cli_${buildOptions.outputPrefix}.json`);
      fs.writeFileSync(timestampedPath, JSON.stringify(data, null, 2));
      console.log(`CLI graph data saved to: ${timestampedPath}`);

      const timestampedJsPath = path.join(frontendDir, `data_cli_${buildOptions.outputPrefix}.js`);
      const tsJsContent = `const graphData = ${JSON.stringify(liteData, null, 2)};`;
      fs.writeFileSync(timestampedJsPath, tsJsContent);
      console.log(`CLI JS data saved to: ${timestampedJsPath}`);
  } else {
      // Standard/Server Mode
      // Save standard file for frontend to work (Active Graph)
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`Graph data saved to: ${outputPath}`);

      const jsOutputPath = path.join(frontendDir, 'data.js');
      const jsContent = `const graphData = ${JSON.stringify(liteData, null, 2)};`;
      fs.writeFileSync(jsOutputPath, jsContent);
      console.log(`Graph data JS saved to: ${jsOutputPath}`);

      // MULTI-FOLDER CACHING FEATURE
      // If a specific subfolder target was provided, save a cached copy
      if (buildOptions.targetPath) {
          try {
              const targetName = path.basename(buildOptions.targetPath).replace(/[^a-z0-9_\-]/gi, '_'); // Sanitize
              // Only cache if not the root KB itself (heuristically check name or usually targetPath is empty for root in frontend logic?)
              // In our logic: targetPath is undefined for "All Folders". So if it exists, it's a subfolder.
              
              if (targetName && targetName.toLowerCase() !== 'knowledge_base') {
                  const cacheJsPath = path.join(frontendDir, `data_${targetName}.js`);
                  const cacheJsonPath = path.join(frontendDir, `graph_data_${targetName}.json`);
                  
                  fs.writeFileSync(cacheJsPath, jsContent);
                  fs.writeFileSync(cacheJsonPath, JSON.stringify(data, null, 2));
                  console.log(`[Cache] Saved cached graph for '${targetName}' to: ${cacheJsPath}`);
              }
          } catch (e) {
              console.warn('[Cache] Failed to save cached copy:', e);
          }
      }
  }
  
  return data;
}

// Allow direct execution
if (require.main === module) {
    const args = process.argv.slice(2);
    // If arg provided, use it. If not, default to 'testconcept' for backward compatibility 
    // OR just handle 'Knowledge_Base' full scan.
    
    // For CLI usage:
    const target = args[0] || 'testconcept'; 
    
    buildGraph(target).catch(err => {
        console.error('Error:', err);
    });
}
