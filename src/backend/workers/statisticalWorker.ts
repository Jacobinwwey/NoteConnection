import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import { CrashLogger } from '../utils/CrashLogger';

CrashLogger.initGlobalHandlers();

import { RawFile } from '../FileLoader';

interface WorkerData {
  filePaths?: string[];
  filesChunk?: RawFile[];
  terms: string[];
}

// Map<filename, foundTerms[]>
type FileTermsResult = Record<string, string[]>;

try {
    const { filePaths, filesChunk, terms } = workerData as WorkerData;
    
    const usePaths = !!filePaths;
    const itemsCount = usePaths ? filePaths!.length : filesChunk!.length;

    const results: FileTermsResult = {};

    for (let i = 0; i < itemsCount; i++) {
        try {
            let content = '';
            let filename = '';

            if (usePaths) {
                const filePath = filePaths![i];
                content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
                filename = path.basename(filePath, path.extname(filePath));
            } else {
                const file = filesChunk![i];
                content = file.content.toLowerCase();
                filename = file.filename;
            }

            const foundTerms: string[] = [];
            
            terms.forEach(term => {
                // Simple inclusion check
                if (content.includes(term.toLowerCase())) {
                    foundTerms.push(term);
                }
            });

            if (foundTerms.length > 0) {
                results[filename] = foundTerms;
            }
        } catch (err) {
            console.warn(`[StatisticalWorker] Failed to process item ${i}`, err);
        }
    }

    if (parentPort) {
      parentPort.postMessage(results);
    }
} catch (error) {
    CrashLogger.log(error, 'StatisticalWorker');
    process.exit(1);
}
