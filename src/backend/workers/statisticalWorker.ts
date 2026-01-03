import { parentPort, workerData } from 'worker_threads';
import { RawFile } from '../FileLoader';
import { CrashLogger } from '../utils/CrashLogger';

CrashLogger.initGlobalHandlers();

interface WorkerData {
  filesChunk: RawFile[];
  terms: string[];
}

// Map<filename, foundTerms[]>
type FileTermsResult = Record<string, string[]>;

try {
    const { filesChunk, terms } = workerData as WorkerData;

    const results: FileTermsResult = {};

    filesChunk.forEach(file => {
        const content = file.content.toLowerCase();
        const foundTerms: string[] = [];
        
        terms.forEach(term => {
            // Simple inclusion check
            if (content.includes(term.toLowerCase())) {
                foundTerms.push(term);
            }
        });

        if (foundTerms.length > 0) {
            results[file.filename] = foundTerms;
        }
    });

    if (parentPort) {
      parentPort.postMessage(results);
    }
} catch (error) {
    CrashLogger.log(error, 'StatisticalWorker');
    process.exit(1);
}
