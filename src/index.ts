import * as path from 'path';
import * as fs from 'fs';
import { FileLoader } from './backend/FileLoader';
import { GraphBuilder } from './backend/GraphBuilder';

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const conceptDir = path.join(projectRoot, 'testconcept');
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

  const graph = GraphBuilder.build(files, layoutMap);
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
}

main().catch(err => {
  console.error('Error:', err);
});
