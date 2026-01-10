import * as path from 'path';
import * as fs from 'fs';
import { NoteConnection } from './core/NoteConnection';

export async function buildGraph(targetPath?: string, maxWorkers?: number, enableGPU?: boolean, enableGPULayout?: boolean, memorySavingMode?: boolean, deepDebug?: boolean) {
  const projectRoot = path.resolve(__dirname, '..');
  
  const result = await NoteConnection.build({
      targetPath,
      maxWorkers,
      enableGPU,
      enableGPULayout,
      memorySavingMode,
      deepDebug,
      projectRoot
  });

  const data = result.data;

  // File Output Logic (CLI/Server Specific)
  const outputPath = path.join(projectRoot, 'src', 'frontend', 'graph_data.json');
  
  // Ensure frontend directory exists
  const frontendDir = path.dirname(outputPath);
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Graph data saved to: ${outputPath}`);

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

  const jsOutputPath = path.join(projectRoot, 'src', 'frontend', 'data.js');
  const jsContent = `const graphData = ${JSON.stringify(liteData, null, 2)};`;
  fs.writeFileSync(jsOutputPath, jsContent);
  console.log(`Graph data JS saved to: ${jsOutputPath}`);
  
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