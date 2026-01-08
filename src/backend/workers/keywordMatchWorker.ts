import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import { checkMatch } from '../utils/stringUtils';
import { CrashLogger } from '../utils/CrashLogger';

CrashLogger.initGlobalHandlers();

import { RawFile } from '../FileLoader';

interface WorkerData {
  filePaths?: string[];
  filesChunk?: RawFile[];
  targetIds: string[];
  strategy: 'exact-phrase' | 'fuzzy';
  exclusionList: string[];
}

interface MatchResult {
  source: string;
  target: string;
}

try {
    const { filePaths, filesChunk, targetIds, strategy, exclusionList } = workerData as WorkerData;
    
    // Determine input source
    const usePaths = !!filePaths;
    const itemsCount = usePaths ? filePaths!.length : filesChunk!.length;

    const results: MatchResult[] = [];

    for (let i = 0; i < itemsCount; i++) {
        let content = '';
        let sourceId = '';
        
        try {
            if (usePaths) {
                const filePath = filePaths![i];
                content = fs.readFileSync(filePath, 'utf-8');
                sourceId = path.basename(filePath, path.extname(filePath));
            } else {
                const file = filesChunk![i];
                content = file.content;
                sourceId = file.filename;
            }

            targetIds.forEach(targetId => {
              if (sourceId === targetId) return;

              if (exclusionList.includes(targetId)) return;

              if (checkMatch(content, targetId, strategy)) {
                results.push({ source: sourceId, target: targetId });
              }
            });
        } catch (err) {
            console.warn(`[KeywordMatchWorker] Failed to process item ${i}`, err);
        }
    }

    if (parentPort) {
      parentPort.postMessage(results);
    }
} catch (error) {
    CrashLogger.log(error, 'KeywordMatchWorker');
    process.exit(1);
}
