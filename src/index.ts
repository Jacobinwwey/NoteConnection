import * as path from 'path';
import * as fs from 'fs';
import { NoteConnection, BuildOptions } from './core/NoteConnection';

export async function buildGraph(options: BuildOptions | string, maxWorkers?: number, enableGPU?: boolean, enableGPULayout?: boolean, memorySavingMode?: boolean, deepDebug?: boolean) {
  const projectRoot = path.resolve(__dirname, '..');
  
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
  const outputPath = path.join(projectRoot, 'src', 'frontend', 'graph_data.json');
  
  // Ensure frontend directory exists
  const frontendDir = path.dirname(outputPath);
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
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
      const timestampedPath = path.join(projectRoot, 'src', 'frontend', `graph_data_cli_${buildOptions.outputPrefix}.json`);
      fs.writeFileSync(timestampedPath, JSON.stringify(data, null, 2));
      console.log(`CLI graph data saved to: ${timestampedPath}`);

      const timestampedJsPath = path.join(projectRoot, 'src', 'frontend', `data_cli_${buildOptions.outputPrefix}.js`);
      const tsJsContent = `const graphData = ${JSON.stringify(liteData, null, 2)};`;
      fs.writeFileSync(timestampedJsPath, tsJsContent);
      console.log(`CLI JS data saved to: ${timestampedJsPath}`);
  } else {
      // Standard/Server Mode
      // Save standard file for frontend to work
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`Graph data saved to: ${outputPath}`);

      const jsOutputPath = path.join(projectRoot, 'src', 'frontend', 'data.js');
      const jsContent = `const graphData = ${JSON.stringify(liteData, null, 2)};`;
      fs.writeFileSync(jsOutputPath, jsContent);
      console.log(`Graph data JS saved to: ${jsOutputPath}`);
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