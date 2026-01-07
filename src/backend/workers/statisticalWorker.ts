import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import { CrashLogger } from '../utils/CrashLogger';

CrashLogger.initGlobalHandlers();

interface WorkerData {
  filePaths: string[];
  terms: string[];
}

// Map<filename, foundTerms[]>
type FileTermsResult = Record<string, string[]>;

try {
    const { filePaths, terms } = workerData as WorkerData;

    const results: FileTermsResult = {};

    filePaths.forEach(filePath => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
            const filename = path.basename(filePath, path.extname(filePath));
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
            console.warn(`[StatisticalWorker] Failed to read file: ${filePath}`, err);
        }
    });

    if (parentPort) {
      parentPort.postMessage(results);
    }
} catch (error) {
    CrashLogger.log(error, 'StatisticalWorker');
    process.exit(1);
}
