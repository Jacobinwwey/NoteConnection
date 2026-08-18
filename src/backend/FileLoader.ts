import * as fs from 'fs';
import * as path from 'path';
import { createResourceIdentity, normalizeResourceRelativePath } from './ResourceIdentity';

export interface RawFile {
  filepath: string;
  filename: string;
  content: string;
  /** Workspace-relative source path; legacy filename remains the graph identity for now. */
  relativePath?: string;
  /** Versioned portable identity; optional for compatibility with synthetic callers. */
  sourceUri?: string;
  /** Canonical workspace-relative identity without a Markdown extension. */
  canonicalId?: string;
  /** Content-addressed revision; optional for compatibility with synthetic callers. */
  revision?: string;
  /** Legacy and portable lookup aliases; optional for compatibility with snapshots. */
  identityAliases?: string[];
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
  static async loadFiles(
    dirPath: string,
    extensions: string[] = ['.md'],
    workspaceRoot: string = dirPath,
  ): Promise<RawFile[]> {
    const filePaths: string[] = [];
    const identityRoot = path.resolve(workspaceRoot);
    
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
                const relativePath = normalizeResourceRelativePath(identityRoot, fullPath);
                const identity = createResourceIdentity(relativePath, filename, content);
                return {
                    filepath: fullPath,
                    filename: filename,
                    content: content,
                    relativePath,
                    sourceUri: identity.sourceUri,
                    canonicalId: identity.canonicalId,
                    revision: identity.revision,
                    identityAliases: identity.identityAliases,
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
