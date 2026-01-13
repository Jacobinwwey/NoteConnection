import * as fs from 'fs';
import * as path from 'path';
import { buildGraph } from '../index'; 

export class NoteController {
    static getFolders(kbRoot: string): string[] {
        if (!fs.existsSync(kbRoot)) {
            return [];
        }
        return fs.readdirSync(kbRoot).filter(file => {
            return fs.statSync(path.join(kbRoot, file)).isDirectory();
        });
    }

    static getContent(targetPath: string, kbRoot: string): string {
        // Security check: Ensure targetPath is within kbRoot
        const resolvedPath = path.resolve(targetPath);
        const resolvedRoot = path.resolve(kbRoot);
        
        if (!resolvedPath.startsWith(resolvedRoot)) {
            throw new Error('Access denied: Path outside Knowledge Base');
        }

        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
            return fs.readFileSync(resolvedPath, 'utf-8');
        }
        return '';
    }

    static async triggerBuild(options: any) {
        // options should match what buildGraph expects
        // we might need to sanitize or map them
        return await buildGraph(options);
    }
}
