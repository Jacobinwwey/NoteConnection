import * as fs from 'fs';
import * as path from 'path';
import { buildGraph } from '../index'; 

export class NoteController {
    static getFolders(kbRoot: string): string[] {
        if (!fs.existsSync(kbRoot)) {
            console.warn(`[Controller] KB root does not exist: ${kbRoot}`);
            return [];
        }
        
        try {
            const subdirs = fs.readdirSync(kbRoot).filter(file => {
                const fullPath = path.join(kbRoot, file);
                try {
                    return fs.statSync(fullPath).isDirectory();
                } catch (err) {
                    console.warn(`[Controller] Cannot access ${fullPath}:`, err);
                    return false;
                }
            });
            
            // Always include ALL_FOLDERS option
            // Return subdirectories only (frontend will prepend ALL_FOLDERS)
            console.log(`[Controller] Found ${subdirs.length} subdirectories in KB root`);
            return subdirs;
        } catch (err) {
            console.error(`[Controller] Error reading KB root:`, err);
            return [];
        }
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
