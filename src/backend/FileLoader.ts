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
    const results: RawFile[] = [];
    
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      console.warn(`Directory not found: ${dirPath}`);
      return [];
    }

    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const subFiles = await FileLoader.loadFiles(fullPath, extensions);
        results.push(...subFiles);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (extensions.includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          results.push({
            filepath: fullPath,
            filename: path.basename(file, ext), // ID is usually filename without ext
            content: content
          });
        }
      }
    }

    return results;
  }
}
