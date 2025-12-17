// src/backend/parser.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import { RawFile, Concept } from './types';

// File Loader Implementation
// 文件加载器实现
export class FileLoader {
    static async loadFiles(directory: string): Promise<RawFile[]> {
        try {
            const filenames = await fs.readdir(directory);
            const rawFiles: RawFile[] = [];

            for (const file of filenames) {
                if (path.extname(file).toLowerCase() !== '.md') continue;

                const fullPath = path.join(directory, file);
                const stat = await fs.stat(fullPath);
                const content = await fs.readFile(fullPath, 'utf-8');

                rawFiles.push({
                    filepath: fullPath,
                    filename: file,
                    content: content,
                    modifiedTime: stat.mtime
                });
            }
            return rawFiles;
        } catch (error) {
            console.error(`Error loading files from ${directory}:`, error);
            return [];
        }
    }
}

// Note Parser Implementation
// 笔记解析器实现
export class NoteParser {
    static parse(files: RawFile[]): Concept[] {
        return files.map(file => {
            const id = path.parse(file.filename).name;
            // Default title is ID, but can be extracted from first H1 if needed
            // 默认标题为ID，但如果需要可以从第一个H1提取
            const title = id; 
            
            // Simple parsing for now (Future: Extract YAML)
            // 目前为简单解析（未来：提取 YAML）
            // Removing special characters for cleaner keyword matching later
            // 移除特殊字符以便后续更干净的关键词匹配
            
            return {
                id: id,
                title: title,
                content: file.content,
                metadata: {
                    tags: [],
                    prerequisites: [] // Placeholder for v0.2.0 explicit parsing
                }
            };
        });
    }
}
