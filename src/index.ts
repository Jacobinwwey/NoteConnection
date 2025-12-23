import * as path from 'path';
import * as fs from 'fs';
import { FileLoader } from './backend/FileLoader';
import { GraphBuilder } from './backend/GraphBuilder';

export async function buildGraph(targetPath?: string) {
  const projectRoot = path.resolve(__dirname, '..');
  // Default to Knowledge_Base if no path provided, or specific folder if provided
  // If targetPath is absolute, use it. If relative, assume relative to Knowledge_Base
  
  let conceptDir: string;
  const kbRoot = path.join(projectRoot, 'Knowledge_Base');

  if (targetPath) {
      if (path.isAbsolute(targetPath)) {
          conceptDir = targetPath;
      } else {
          conceptDir = path.join(kbRoot, targetPath);
      }
  } else {
      // Default behavior or "All"
      conceptDir = kbRoot;
  }

  // Verify directory exists
  if (!fs.existsSync(conceptDir)) {
      throw new Error(`Directory not found: ${conceptDir}`);
  }

  const outputPath = path.join(projectRoot, 'src', 'frontend', 'graph_data.json');

  console.log(`Loading files from: ${conceptDir}`);
  const files = await FileLoader.loadFiles(conceptDir);
  console.log(`Loaded ${files.length} files.`);

  console.log('Building graph...');
  
  // Try to load layout.json
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

  const graph = await GraphBuilder.build(files, layoutMap);
  const data = graph.toJSON();
  
  console.log(`Graph built: ${data.nodes.length} nodes, ${data.edges.length} edges.`);

  // Ensure frontend directory exists
  const frontendDir = path.dirname(outputPath);
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Graph data saved to: ${outputPath}`);

  const jsOutputPath = path.join(projectRoot, 'src', 'frontend', 'data.js');
  const jsContent = `const graphData = ${JSON.stringify(data, null, 2)};`;
  fs.writeFileSync(jsOutputPath, jsContent);
  console.log(`Graph data JS saved to: ${jsOutputPath}`);
  
  return data;
}

// Allow direct execution
if (require.main === module) {
    const args = process.argv.slice(2);
    // If arg provided, use it. If not, default to 'testconcept' for backward compatibility 
    // OR just handle 'Knowledge_Base' full scan.
    // Given the prompt "I have placed the entire folder... under the Knowledge_Base path", 
    // let's default to 'testconcept' to match current user context if they run it manually without args,
    // or just 'testconcept' if they provided no args. 
    // Actually, safer to default to the whole 'Knowledge_Base' if they want "one or all".
    // But let's check if 'Knowledge_Base' has files directly? 
    // It seems it has subfolders.
    
    // For CLI usage:
    const target = args[0] || 'testconcept'; 
    
    buildGraph(target).catch(err => {
        console.error('Error:', err);
    });
}