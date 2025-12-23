import * as fs from 'fs';
import * as path from 'path';

export interface RawFile {
  filepath: string;
  filename: string;
  content: string;
}

/**
 * Service to load files from a directory.
 * 从目录加载文件的服务。
 */
export class FileLoader {
  /**
   * Recursively reads files from a directory.
   * 递归读取目录中的文件。
   * @param dirPath Directory path | 目录路径
   * @param extensions File extensions to include (e.g., ['.md']) | 要包含的文件扩展名
   */
  static async loadFiles(dirPath: string, extensions: string[] = ['.md']): Promise<RawFile[]> {
    const filePaths: string[] = [];
    
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      console.warn(`Directory not found: ${dirPath}`);
      return [];
    }

    // 1. Gather all file paths first (Sequential directory scan is safer for handles)
    async function scanDir(currentPath: string) {
        // Use withFileTypes to avoid extra stat calls
        try {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    await scanDir(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (extensions.includes(ext)) {
                        filePaths.push(fullPath);
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to read directory: ${currentPath}`, e);
        }
    }

    await scanDir(dirPath);

    // 2. Read files with concurrency limit
    const results: RawFile[] = [];
    const CONCURRENCY_LIMIT = 100; // Conservative limit

    // Helper to process in batches
    for (let i = 0; i < filePaths.length; i += CONCURRENCY_LIMIT) {
        const batch = filePaths.slice(i, i + CONCURRENCY_LIMIT);
        const batchPromises = batch.map(async (fullPath) => {
            try {
                const content = await fs.promises.readFile(fullPath, 'utf-8');
                const filename = path.basename(fullPath, path.extname(fullPath));
                return {
                    filepath: fullPath,
                    filename: filename,
                    content: content
                };
            } catch (e) {
                console.warn(`Failed to read file: ${fullPath}`, e);
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(res => {
            if (res) results.push(res);
        });
    }

    return results;
  }
}
